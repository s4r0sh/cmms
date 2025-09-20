// routes/aircraft.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// ===================================
// GET all unserviceable aircraft for Aircraft Overview Table (clustered by tail_number)
// ===================================
router.get("/", async (req, res) => {
  try {
    const { squadron } = req.query;

    const baseQuery = `
      SELECT 
        a.tail_number,
        a.type,
        a.variant,
        json_agg(
          json_build_object(
            'reason', j.maintenance_type,
            'details', CASE 
                        WHEN j.maintenance_type='scheduled' THEN i.name
                        ELSE j.discrepancy || ' | ' || j.corrective_action
                      END,
            'time', j.created_at
          ) ORDER BY j.created_at DESC
        ) AS jcns
      FROM aircraft a
      JOIN maintenance_jcn j ON j.aircraft_id = a.id
      LEFT JOIN inspections i ON j.inspection_id = i.id
      WHERE a.operational_status='unserviceable' 
        AND j.status ILIKE 'open'
        ${squadron ? "AND TRIM(a.squadron) ILIKE $1" : ""}
      GROUP BY a.id
      ORDER BY a.tail_number COLLATE "C" ASC;
    `;

    const result = squadron
      ? await pool.query(baseQuery, [`%${squadron}%`])
      : await pool.query(baseQuery);

    // Flatten for DataGrid (1 row per JCN)
    const rows = [];
    result.rows.forEach((aircraft) => {
      // Sort JCNS again just in case (safety measure)
      aircraft.jcns
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .forEach((jcn) => {
          rows.push({
            id: rows.length + 1,
            tail_number: aircraft.tail_number,
            type: aircraft.type,
            variant: aircraft.variant,
            reason: jcn.reason,
            details: jcn.details,
            time: jcn.time
              ? new Date(jcn.time).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "",
          });
        });
    });

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching aircraft overview with JCNS:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ===================================
// GET all aircraft for JCN form dropdown
// ===================================
router.get("/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, tail_number, type, variant
      FROM aircraft
      ORDER BY tail_number;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching all aircraft:", err);
    res.status(500).json({ error: "Failed to fetch all aircraft" });
  }
});

// ===================================
// GET single aircraft by ID
// ===================================
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ensure id is integer
    const aircraftId = parseInt(id, 10);
    if (isNaN(aircraftId)) {
      return res.status(400).json({ error: "Invalid aircraft ID" });
    }

    const result = await pool.query(
      `
      SELECT id, type, variant, tail_number, current_fh, current_fc, current_fl,
             operational_status AS status, unserviceable_reason AS reason, details, squadron
      FROM aircraft
      WHERE id = $1;
      `,
      [aircraftId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Aircraft not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error fetching aircraft by ID:", err);
    res.status(500).json({ error: "Failed to fetch aircraft" });
  }
});

module.exports = router;
