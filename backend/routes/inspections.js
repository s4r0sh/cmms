// routes/inspections.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/inspections → list all inspections
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, trigger_type, interval_value FROM inspections ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching inspections:", err);
    res.status(500).json({ error: "Failed to fetch inspections" });
  }
});

// GET /api/inspections/planning?horizon=100
router.get("/planning", async (req, res) => {
  try {
    const horizon = parseInt(req.query.horizon) || 100;
    const squadron = req.query.squadron || null;

    let baseQuery = `
      WITH calendar_last AS (
          SELECT 
              ih.aircraft_id,
              ih.inspection_id,
              MAX(ih.performed_on) AS last_performed
          FROM inspection_history ih
          JOIN inspections ins ON ih.inspection_id = ins.id
          WHERE ins.trigger_type = 'CALENDAR'
          GROUP BY ih.aircraft_id, ih.inspection_id
      ),
      fh_last AS (
          SELECT 
              ih.aircraft_id,
              ih.inspection_id,
              MAX(ih.fh_at_inspection) AS last_fh
          FROM inspection_history ih
          JOIN inspections ins ON ih.inspection_id = ins.id
          WHERE ins.trigger_type = 'FH'
          GROUP BY ih.aircraft_id, ih.inspection_id
      ),
      fc_last AS (
          SELECT 
              ih.aircraft_id,
              ih.inspection_id,
              MAX(ih.fc_at_inspection) AS last_fc
          FROM inspection_history ih
          JOIN inspections ins ON ih.inspection_id = ins.id
          WHERE ins.trigger_type = 'FC'
          GROUP BY ih.aircraft_id, ih.inspection_id
      ),
      fl_last AS (
          SELECT 
              ih.aircraft_id,
              ih.inspection_id,
              MAX(ih.fl_at_inspection) AS last_fl
          FROM inspection_history ih
          JOIN inspections ins ON ih.inspection_id = ins.id
          WHERE ins.trigger_type = 'FL'
          GROUP BY ih.aircraft_id, ih.inspection_id
      ),
      planning AS (
          SELECT 
              a.tail_number,
              a.squadron,
              a.type,
              a.variant,
              i.name AS inspection_name,
              i.trigger_type,
              i.interval_value,

              -- Next due values
              CASE 
                  WHEN i.trigger_type = 'FH' THEN fh.last_fh + i.interval_value
                  WHEN i.trigger_type = 'FC' THEN fc.last_fc + i.interval_value
                  WHEN i.trigger_type = 'FL' THEN fl.last_fl + i.interval_value
                  ELSE NULL
              END AS next_due_numeric,

              CASE 
                  WHEN i.trigger_type = 'CALENDAR' 
                      THEN COALESCE(cl.last_performed, NOW()) + (i.interval_value || ' days')::interval
                  ELSE NULL
              END AS next_due_date,

              -- Remaining until due
              CASE 
                  WHEN i.trigger_type = 'FH' THEN (fh.last_fh + i.interval_value) - a.current_fh
                  WHEN i.trigger_type = 'FC' THEN (fc.last_fc + i.interval_value) - a.current_fc
                  WHEN i.trigger_type = 'FL' THEN (fl.last_fl + i.interval_value) - a.current_fl
                  WHEN i.trigger_type = 'CALENDAR' 
                      THEN EXTRACT(DAY FROM (COALESCE(cl.last_performed, NOW()) + (i.interval_value || ' days')::interval - NOW()))
              END AS remaining_until_due
          FROM aircraft a
          CROSS JOIN inspections i
          LEFT JOIN calendar_last cl ON cl.aircraft_id = a.id AND cl.inspection_id = i.id
          LEFT JOIN fh_last fh ON fh.aircraft_id = a.id AND fh.inspection_id = i.id
          LEFT JOIN fc_last fc ON fc.aircraft_id = a.id AND fc.inspection_id = i.id
          LEFT JOIN fl_last fl ON fl.aircraft_id = a.id AND fl.inspection_id = i.id
      )
      SELECT *
FROM planning
WHERE remaining_until_due <= $1

    `;

    const params = [horizon];

    // ✅ Add optional squadron filter
    if (squadron && squadron.trim() !== "") {
      baseQuery += " AND squadron = $2";
      params.push(squadron);
    }

    baseQuery +=
      " ORDER BY remaining_until_due ASC, tail_number, inspection_name;";

    const result = await pool.query(baseQuery, params);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Inspection planning error:", err);
    res.status(500).json({ error: "Failed to fetch inspection planning" });
  }
});

// POST /api/inspections/initialize-history
router.post("/initialize-history", async (req, res) => {
  try {
    // 🔹 First wipe existing history so reseed is always fresh
    await pool.query("TRUNCATE inspection_history RESTART IDENTITY CASCADE");

    const aircraftRes = await pool.query(
      "SELECT id, current_fh, current_fc, current_fl FROM aircraft"
    );
    const inspectionsRes = await pool.query(
      "SELECT id, trigger_type, interval_value FROM inspections"
    );

    const now = new Date();

    for (const ac of aircraftRes.rows) {
      for (const ins of inspectionsRes.rows) {
        let performed_on = null;
        let fh = null;
        let fc = null;
        let fl = null;

        if (ins.trigger_type === "CALENDAR") {
          // randomize last performed date within interval
          const randomOffset = Math.floor(Math.random() * ins.interval_value);
          performed_on = new Date(now);
          performed_on.setDate(now.getDate() - randomOffset);
        } else if (ins.trigger_type === "FH") {
          const randomOffset = Math.floor(Math.random() * ins.interval_value);
          fh = ac.current_fh - randomOffset;
          if (fh < 0) fh = 0;
        } else if (ins.trigger_type === "FC") {
          const randomOffset = Math.floor(Math.random() * ins.interval_value);
          fc = ac.current_fc - randomOffset;
          if (fc < 0) fc = 0;
        } else if (ins.trigger_type === "FL") {
          const randomOffset = Math.floor(Math.random() * ins.interval_value);
          fl = ac.current_fl - randomOffset;
          if (fl < 0) fl = 0;
        }

        let query, values;
        if (ins.trigger_type === "CALENDAR") {
          query = `
            INSERT INTO inspection_history (aircraft_id, inspection_id, performed_on)
            VALUES ($1, $2, $3)
          `;
          values = [ac.id, ins.id, performed_on];
        } else if (ins.trigger_type === "FH") {
          query = `
            INSERT INTO inspection_history (aircraft_id, inspection_id, fh_at_inspection)
            VALUES ($1, $2, $3)
          `;
          values = [ac.id, ins.id, fh];
        } else if (ins.trigger_type === "FC") {
          query = `
            INSERT INTO inspection_history (aircraft_id, inspection_id, fc_at_inspection)
            VALUES ($1, $2, $3)
          `;
          values = [ac.id, ins.id, fc];
        } else if (ins.trigger_type === "FL") {
          query = `
            INSERT INTO inspection_history (aircraft_id, inspection_id, fl_at_inspection)
            VALUES ($1, $2, $3)
          `;
          values = [ac.id, ins.id, fl];
        }

        await pool.query(query, values);

        console.log(
          `Inserted: AC=${ac.id}, Insp=${ins.id}, performed_on=${performed_on}, FH=${fh}, FC=${fc}, FL=${fl}`
        );
      }
    }

    res.json({
      message: "✅ Inspection history reseeded with randomized values",
    });
  } catch (err) {
    console.error("❌ Failed to initialize inspection history:", err);
    res.status(500).json({ error: err.message || "Initialization failed" });
  }
});

module.exports = router;
