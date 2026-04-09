const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const { horizon, squadron, start, end } = req.query;

    // Date range logic
    let dateFilter = "";
    if (horizon && horizon !== "custom") {
      dateFilter = `AND j.created_at >= NOW() - INTERVAL '${horizon} days'`;
    } else if (horizon === "custom" && start && end) {
      dateFilter = `AND j.created_at BETWEEN '${start}' AND '${end}'`;
    }

    let squadronFilter = "";
    if (squadron) {
      squadronFilter = `AND a.squadron = '${squadron}'`;
    }

    // ✅ Corrected Query
    const result = await pool.query(`
      SELECT 
        a.tail_number,
        a.type AS aircraft_type,
        a.variant AS aircraft_variant,
        j.work_unit_code AS wuc,
        j.discrepancy,
        j.corrective_action,
        j.created_at
      FROM maintenance_jcn j
      JOIN aircraft a ON j.aircraft_id = a.id
      WHERE j.maintenance_type = 'unscheduled'
      ${dateFilter}
      ${squadronFilter}
      ORDER BY j.created_at DESC;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching defect trend:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================================
// 📈 TOP 3 DEFECTIVE SYSTEMS (WUC)
// ======================================
router.get("/top-systems", async (req, res) => {
  try {
    const { horizon, squadron, start, end } = req.query;

    let dateFilter = "";
    if (horizon && horizon !== "custom") {
      dateFilter = `AND j.created_at >= NOW() - INTERVAL '${horizon} days'`;
    } else if (horizon === "custom" && start && end) {
      dateFilter = `AND j.created_at BETWEEN '${start}' AND '${end}'`;
    }

    let squadronFilter = "";
    if (squadron) {
      squadronFilter = `AND a.squadron = '${squadron}'`;
    }

    const result = await pool.query(`
      SELECT 
        j.work_unit_code AS wuc,
        COUNT(*) AS count
      FROM maintenance_jcn j
      JOIN aircraft a ON j.aircraft_id = a.id
      WHERE j.maintenance_type = 'unscheduled'
      ${dateFilter}
      ${squadronFilter}
      GROUP BY j.work_unit_code
      ORDER BY COUNT(*) DESC
      LIMIT 3;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching top defective systems:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================================
// ✈️ TOP 3 DEFECTIVE AIRCRAFT
// ======================================
router.get("/top-aircraft", async (req, res) => {
  try {
    const { horizon, squadron, start, end } = req.query;

    let dateFilter = "";
    if (horizon && horizon !== "custom") {
      dateFilter = `AND j.created_at >= NOW() - INTERVAL '${horizon} days'`;
    } else if (horizon === "custom" && start && end) {
      dateFilter = `AND j.created_at BETWEEN '${start}' AND '${end}'`;
    }

    let squadronFilter = "";
    if (squadron) {
      squadronFilter = `AND a.squadron = '${squadron}'`;
    }

    const result = await pool.query(`
      SELECT 
        a.tail_number,
        COUNT(*) AS count
      FROM maintenance_jcn j
      JOIN aircraft a ON j.aircraft_id = a.id
      WHERE j.maintenance_type = 'unscheduled'
      ${dateFilter}
      ${squadronFilter}
      GROUP BY a.tail_number
      ORDER BY COUNT(*) DESC
      LIMIT 3;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching top defective aircraft:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ======================================
// 📊 AVG DEFECTS PER AIRCRAFT TYPE
// ======================================
router.get("/avg-by-type", async (req, res) => {
  try {
    const { horizon, squadron, start, end } = req.query;

    let dateFilter = "";
    if (horizon && horizon !== "custom") {
      dateFilter = `AND j.created_at >= NOW() - INTERVAL '${horizon} days'`;
    } else if (horizon === "custom" && start && end) {
      dateFilter = `AND j.created_at BETWEEN '${start}' AND '${end}'`;
    }

    let squadronFilter = "";
    if (squadron) {
      squadronFilter = `AND a.squadron = '${squadron}'`;
    }

    const result = await pool.query(`
      SELECT 
        a.type AS aircraft_type,
        ROUND(COUNT(*)::numeric / COUNT(DISTINCT a.tail_number), 2) AS avg_defects
      FROM maintenance_jcn j
      JOIN aircraft a ON j.aircraft_id = a.id
      WHERE j.maintenance_type = 'unscheduled'
      ${dateFilter}
      ${squadronFilter}
      GROUP BY a.type
      ORDER BY avg_defects DESC
      LIMIT 5;
    `);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching avg defects by type:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
