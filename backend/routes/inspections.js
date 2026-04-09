// routes/inspections.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

//helper jcngenerator function for planning scheduled inspections
function generateReservedJcnNo({ tail = "UNK", inspectionId }) {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const tailClean = (tail || "UNK").replace(/\W/g, "").slice(-4).toUpperCase();
  const rnd = Math.floor(Math.random() * 900 + 100); // 3 digits
  return `SCH-${tailClean}-${inspectionId}-${ts}-${rnd}`;
}

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

// GET /api/inspections/scheduled-reservations
// returns active reservations (for JcnForm dropdown)
router.get("/scheduled-reservations", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.jcn_no, s.inspection_id, s.aircraft_id, s.scheduled_at,
              a.tail_number, i.name AS inspection_name
       FROM scheduled_inspections s
       JOIN aircraft a ON s.aircraft_id = a.id
       JOIN inspections i ON s.inspection_id = i.id
       WHERE s.cancelled = FALSE
       ORDER BY s.scheduled_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching scheduled reservations:", err);
    res.status(500).json({ error: "Failed to fetch scheduled reservations" });
  }
});

// GET /api/inspections/planning?horizon=100
router.get("/planning", async (req, res) => {
  try {
    const horizon = parseInt(req.query.horizon) || 100;
    const squadron = req.query.squadron || null;

    const params = [horizon];
    let idx = 2;

    let squadronFilter = "";
    if (squadron && squadron.trim() !== "") {
      squadronFilter = `AND a.squadron = $${idx++}`;
      params.push(squadron);
    }

    const baseQuery = `
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
          -- 1️⃣ Standard inspections for all aircraft
          SELECT 
              i.id AS inspection_id,
              a.id AS aircraft_id,
              a.tail_number,
              a.squadron,
              a.type,
              a.variant,
              i.name AS inspection_name,
              i.trigger_type,
              i.interval_value,
              i.is_custom,

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
          WHERE i.is_custom = FALSE
          ${squadronFilter}

          UNION ALL

          -- 2️⃣ Custom inspections: only for aircraft where a JCN was created
          SELECT 
              i.id AS inspection_id,
               a.id AS aircraft_id,
               a.tail_number,
              a.squadron,
              a.type,
              a.variant,
              i.name AS inspection_name,
              i.trigger_type,
              i.interval_value,
              i.is_custom,

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

              CASE 
                  WHEN i.trigger_type = 'FH' THEN (fh.last_fh + i.interval_value) - a.current_fh
                  WHEN i.trigger_type = 'FC' THEN (fc.last_fc + i.interval_value) - a.current_fc
                  WHEN i.trigger_type = 'FL' THEN (fl.last_fl + i.interval_value) - a.current_fl
                  WHEN i.trigger_type = 'CALENDAR' 
                      THEN EXTRACT(DAY FROM (COALESCE(cl.last_performed, NOW()) + (i.interval_value || ' days')::interval - NOW()))
              END AS remaining_until_due
          FROM aircraft a
          JOIN maintenance_jcn j ON j.aircraft_id = a.id AND j.status='CLOSED'
          JOIN inspections i ON i.id = j.inspection_id
          LEFT JOIN calendar_last cl ON cl.aircraft_id = a.id AND cl.inspection_id = i.id
          LEFT JOIN fh_last fh ON fh.aircraft_id = a.id AND fh.inspection_id = i.id
          LEFT JOIN fc_last fc ON fc.aircraft_id = a.id AND fc.inspection_id = i.id
          LEFT JOIN fl_last fl ON fl.aircraft_id = a.id AND fl.inspection_id = i.id
          WHERE i.is_custom = TRUE
          ${squadronFilter}
      )
      SELECT 
        p.*,
        si.jcn_no AS scheduled_jcn_no,
        (si.cancelled = FALSE AND si.id IS NOT NULL) AS scheduled
      FROM planning p
LEFT JOIN aircraft a ON a.tail_number = p.tail_number
LEFT JOIN inspections i ON i.name = p.inspection_name
LEFT JOIN scheduled_inspections si 
  ON si.inspection_id = i.id
  AND si.aircraft_id = a.id
  AND si.cancelled = FALSE
WHERE p.remaining_until_due <= $1
ORDER BY p.remaining_until_due ASC, p.tail_number, p.inspection_name;

    `;

    const result = await pool.query(baseQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Inspection planning error:", err);
    res.status(500).json({ error: "Failed to fetch inspection planning" });
  }
});

// GET /api/inspections/scheduled
// Used by JCN form when maintenance type = scheduled
router.get("/scheduled", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.jcn_no, s.inspection_id, s.aircraft_id, s.scheduled_at,
              a.tail_number, i.name AS inspection_name
       FROM scheduled_inspections s
       JOIN aircraft a ON s.aircraft_id = a.id
       JOIN inspections i ON s.inspection_id = i.id
       WHERE s.cancelled = FALSE
       ORDER BY s.scheduled_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching scheduled inspections:", err);
    res.status(500).json({ error: "Failed to fetch scheduled inspections" });
  }
});

// routes/inspections.js
router.get("/scheduled/upcoming", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT si.id,
             i.name AS inspection_name,
             a.tail_number AS aircraft_name,
             a.id AS aircraft_id,
             si.scheduled_date
      FROM scheduled_inspections si
      JOIN inspections i ON i.id = si.inspection_id
      JOIN aircraft a ON a.id = si.aircraft_id
      WHERE si.cancelled = FALSE AND si.scheduled_date >= NOW()
      ORDER BY si.scheduled_date ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching upcoming inspections:", err);
    res.status(500).json({ error: "Failed to load upcoming inspections" });
  }
});

// GET /api/jcns/scheduled/pending
router.get("/scheduled/pending", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT si.id AS scheduled_id,
             i.name AS inspection_name,
             a.tail_number AS aircraft_name,
             si.aircraft_id,
             si.inspection_id,
             si.scheduled_date
      FROM scheduled_inspections si
      JOIN inspections i ON i.id = si.inspection_id
      JOIN aircraft a ON a.id = si.aircraft_id
      LEFT JOIN jcns j ON j.scheduled_inspection_id = si.id
      WHERE j.id IS NULL
      ORDER BY si.scheduled_date ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching pending scheduled inspections:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch pending scheduled inspections" });
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

// POST /api/inspections/:id/schedule
// Body: { aircraft_id }
router.post("/:id/schedule", async (req, res) => {
  try {
    const inspection_id = parseInt(req.params.id, 10);
    const { aircraft_id } = req.body;
    if (!inspection_id || !aircraft_id) {
      return res
        .status(400)
        .json({ error: "inspection_id and aircraft_id required" });
    }

    // check inspection exists
    const ins = await pool.query(
      "SELECT id, name FROM inspections WHERE id = $1",
      [inspection_id]
    );
    if (ins.rowCount === 0) {
      return res.status(404).json({ error: "Inspection not found" });
    }

    // check aircraft exists
    const ac = await pool.query(
      "SELECT id, tail_number FROM aircraft WHERE id = $1",
      [aircraft_id]
    );
    if (ac.rowCount === 0) {
      return res.status(404).json({ error: "Aircraft not found" });
    }

    // idempotency: if already scheduled (not cancelled), return existing
    const existing = await pool.query(
      `SELECT id, jcn_no, scheduled_at FROM scheduled_inspections
       WHERE inspection_id = $1 AND aircraft_id = $2 AND cancelled = FALSE`,
      [inspection_id, aircraft_id]
    );
    if (existing.rowCount > 0) {
      return res
        .status(200)
        .json({ scheduled: true, reservation: existing.rows[0] });
    }

    // generate jcn_no and insert
    const jcnNo = generateReservedJcnNo({
      tail: ac.rows[0].tail_number,
      inspectionId: inspection_id,
    });

    const insert = await pool.query(
      `INSERT INTO scheduled_inspections (inspection_id, aircraft_id, jcn_no)
       VALUES ($1,$2,$3) RETURNING id, jcn_no, scheduled_at`,
      [inspection_id, aircraft_id, jcnNo]
    );

    res.status(201).json({ scheduled: true, reservation: insert.rows[0] });
  } catch (err) {
    console.error("❌ Error scheduling inspection:", err);
    res.status(500).json({ error: "Failed to schedule inspection" });
  }
});

// DELETE /api/inspections/:id/schedule
// Body: { aircraft_id }
router.delete("/:id/schedule", async (req, res) => {
  try {
    const inspection_id = parseInt(req.params.id, 10);
    const { aircraft_id } = req.body;
    if (!inspection_id || !aircraft_id) {
      return res
        .status(400)
        .json({ error: "inspection_id and aircraft_id required" });
    }

    // Find reservation
    const existing = await pool.query(
      `SELECT id, jcn_no FROM scheduled_inspections
       WHERE inspection_id = $1 AND aircraft_id = $2 AND cancelled = FALSE`,
      [inspection_id, aircraft_id]
    );
    if (existing.rowCount === 0) {
      return res
        .status(404)
        .json({ error: "No active scheduled reservation found" });
    }

    const id = existing.rows[0].id;
    // Option A: hard delete:
    await pool.query("DELETE FROM scheduled_inspections WHERE id = $1", [id]);

    // Option B (soft-cancel): uncomment instead and comment out DELETE above:
    // await pool.query("UPDATE scheduled_inspections SET cancelled = TRUE WHERE id = $1", [id]);

    res.json({ cancelled: true });
  } catch (err) {
    console.error("❌ Error cancelling scheduled inspection:", err);
    res.status(500).json({ error: "Failed to cancel scheduled inspection" });
  }
});

module.exports = router;
