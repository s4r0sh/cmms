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

    const result = await pool.query(
      `
      WITH calendar_last AS (
          -- Get the last performed date for each aircraft and calendar inspection
          SELECT 
              ih.aircraft_id,
              ih.inspection_id,
              MAX(ih.performed_on) AS last_performed
          FROM inspection_history ih
          JOIN inspections ins ON ih.inspection_id = ins.id
          WHERE ins.trigger_type = 'CALENDAR'
          GROUP BY ih.aircraft_id, ih.inspection_id
      ),
      planning AS (
        SELECT 
            a.tail_number,
            a.type,
            a.variant,
            i.name AS inspection_name,
            i.trigger_type,
            i.interval_value,
            
            -- Next due numeric for FH, FC, FL
            CASE 
                WHEN i.trigger_type = 'FH' THEN a.current_fh + i.interval_value
                WHEN i.trigger_type = 'FC' THEN a.current_fc + i.interval_value
                WHEN i.trigger_type = 'FL' THEN a.current_fl + i.interval_value
                ELSE NULL
            END AS next_due_numeric,
            
            -- Next due date for CALENDAR inspections
            CASE 
                WHEN i.trigger_type = 'CALENDAR' 
                    THEN COALESCE(cl.last_performed, NOW()) + (i.interval_value || ' days')::interval
                ELSE NULL
            END AS next_due_date,
            
            -- Remaining until due
            CASE 
                WHEN i.trigger_type = 'FH' THEN i.interval_value
                WHEN i.trigger_type = 'FC' THEN i.interval_value
                WHEN i.trigger_type = 'FL' THEN i.interval_value
                WHEN i.trigger_type = 'CALENDAR' 
                    THEN EXTRACT(DAY FROM (COALESCE(cl.last_performed, NOW()) + (i.interval_value || ' days')::interval - NOW()))
            END AS remaining_until_due
        FROM aircraft a
        CROSS JOIN inspections i
        LEFT JOIN calendar_last cl
          ON cl.aircraft_id = a.id AND cl.inspection_id = i.id
      )
      SELECT *
      FROM planning
      WHERE remaining_until_due <= $1
      ORDER BY tail_number, inspection_name;
      `,
      [horizon]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Inspection planning error:", err);
    res.status(500).json({ error: "Failed to fetch inspection planning" });
  }
});

module.exports = router;
