// routes/jcns.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// =============================
// GET all JCNS (with optional filters)
// =============================
router.get("/", async (req, res) => {
  try {
    const { tail_number, status } = req.query;

    let query = `
      SELECT j.id, j.jcn_no, j.maintenance_type, j.work_unit_code,
             j.discrepancy, j.corrective_action, j.status, j.created_at, j.closed_at,
             a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant,
             j.aircraft_id, j.inspection_id,
             i.name AS inspection_name, i.trigger_type, i.interval_value
      FROM maintenance_jcn j
      LEFT JOIN aircraft a ON j.aircraft_id = a.id
      LEFT JOIN inspections i ON j.inspection_id = i.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (tail_number) {
      query += ` AND a.tail_number = $${idx++}`;
      params.push(tail_number);
    }

    if (status) {
      query += ` AND j.status = $${idx++}`;
      params.push(status);
    }

    query += " ORDER BY j.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching JCNS:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// =============================
// GET all OPEN JCNS (for update/close list)
// =============================
router.get("/open", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT j.id, j.jcn_no, j.maintenance_type, j.discrepancy, j.corrective_action, j.status,
             j.created_at, a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant,
             j.aircraft_id, j.inspection_id, i.name AS inspection_name, i.trigger_type, i.interval_value
      FROM maintenance_jcn j
      JOIN aircraft a ON j.aircraft_id = a.id
      LEFT JOIN inspections i ON j.inspection_id = i.id
      WHERE j.status = 'OPEN'
      ORDER BY j.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching open JCNS:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// =============================
// GET single JCN with its demands
// =============================
router.get("/:id", async (req, res) => {
  try {
    const jcnResult = await pool.query(
      `
      SELECT j.*, a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant,
             i.name AS inspection_name, i.trigger_type, i.interval_value
      FROM maintenance_jcn j
      LEFT JOIN aircraft a ON j.aircraft_id = a.id
      LEFT JOIN inspections i ON j.inspection_id = i.id
      WHERE j.id = $1
      `,
      [req.params.id]
    );

    if (jcnResult.rows.length === 0) {
      return res.status(404).json({ error: "JCN not found" });
    }

    const demandsResult = await pool.query(
      `
      SELECT d.*, c.part_number, c.nomenclature
      FROM maintenance_demands d
      LEFT JOIN components c ON d.component_id = c.id
      WHERE d.jcn_id = $1
      `,
      [req.params.id]
    );

    res.json({ jcn: jcnResult.rows[0], demands: demandsResult.rows });
  } catch (err) {
    console.error("❌ Error fetching JCN:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// =============================
// GET all inspections (for frontend dropdown)
// =============================
router.get("/inspections", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, trigger_type, interval_value FROM inspections ORDER BY trigger_type, interval_value"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching inspections:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// =============================
// CREATE new JCN (with optional immediate close)
// =============================
// =============================
// CREATE new JCN (with optional immediate close + custom inspection)
// =============================
router.post("/", async (req, res) => {
  try {
    console.log("📥 Incoming JCN payload:", req.body);

    let {
      jcn_no,
      aircraft_id,
      maintenance_type,
      work_unit_code,
      discrepancy,
      corrective_action,
      inspection_id,
      custom_inspection_name,
      custom_trigger_type,
      custom_interval_value,
      close,
    } = req.body;

    // Handle custom inspection
    if (
      maintenance_type === "scheduled" &&
      custom_inspection_name &&
      custom_trigger_type &&
      custom_interval_value
    ) {
      const intervalInt = parseInt(custom_interval_value, 10);
      if (isNaN(intervalInt) || intervalInt <= 0) {
        return res
          .status(400)
          .json({ error: "Custom interval must be a positive number" });
      }

      try {
        const customInsert = await pool.query(
          `INSERT INTO inspections (name, trigger_type, interval_value, is_custom)
           VALUES ($1,$2,$3, TRUE) RETURNING id`,
          [custom_inspection_name, custom_trigger_type, intervalInt]
        );
        inspection_id = customInsert.rows[0].id;
        console.log("✅ Custom inspection created with id:", inspection_id);
      } catch (err) {
        console.error("❌ Failed to create custom inspection:", err);
        return res
          .status(500)
          .json({ error: "Failed to create custom inspection" });
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO maintenance_jcn
       (jcn_no, aircraft_id, maintenance_type, work_unit_code, discrepancy, corrective_action, inspection_id, status, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        jcn_no,
        aircraft_id,
        maintenance_type,
        work_unit_code,
        discrepancy,
        corrective_action,
        inspection_id || null,
        close ? "CLOSED" : "OPEN",
        close ? new Date() : null,
      ]
    );

    const newId = insertResult.rows[0].id;

    const fullResult = await pool.query(
      `SELECT j.id, j.jcn_no, j.maintenance_type, j.work_unit_code,
              j.discrepancy, j.corrective_action, j.status, j.created_at, j.closed_at,
              a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant,
              j.inspection_id, i.name AS inspection_name, i.trigger_type, i.interval_value
       FROM maintenance_jcn j
       LEFT JOIN aircraft a ON j.aircraft_id = a.id
       LEFT JOIN inspections i ON j.inspection_id = i.id
       WHERE j.id = $1`,
      [newId]
    );

    res.status(201).json(fullResult.rows[0]);
  } catch (err) {
    console.error("❌ Error creating JCN:", err);
    res.status(500).json({ error: "Failed to create JCN" });
  }
});

// =============================
// RAISE demand under JCN
// =============================
router.post("/:id/demands", async (req, res) => {
  try {
    const { component_id, quantity } = req.body;

    if (!component_id) {
      return res.status(400).json({ error: "Component ID is required" });
    }

    const result = await pool.query(
      `
      INSERT INTO maintenance_demands (jcn_id, component_id, quantity, status)
      VALUES ($1,$2,$3,'PENDING')
      RETURNING *;
      `,
      [req.params.id, component_id, quantity || 1]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error raising demand:", err);
    res.status(500).json({ error: "Failed to raise demand" });
  }
});

// =============================
// UPDATE JCN (corrective action / close)
// =============================
router.put("/:id", async (req, res) => {
  try {
    const { corrective_action, close } = req.body;

    const updateQuery = close
      ? `
        UPDATE maintenance_jcn
        SET corrective_action = COALESCE($1, corrective_action),
            status = 'CLOSED',
            closed_at = NOW()
        WHERE id = $2 AND status = 'OPEN'
        RETURNING id;
      `
      : `
        UPDATE maintenance_jcn
        SET corrective_action = COALESCE($1, corrective_action)
        WHERE id = $2 AND status = 'OPEN'
        RETURNING id;
      `;

    const updateResult = await pool.query(updateQuery, [
      corrective_action,
      req.params.id,
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "JCN not found or already closed" });
    }

    // 🔄 fetch the updated row with same shape as other endpoints
    const fullResult = await pool.query(
      `
      SELECT j.id, j.jcn_no, j.maintenance_type, j.work_unit_code,
             j.discrepancy, j.corrective_action, j.status, j.created_at, j.closed_at,
             j.inspection_id, i.name AS inspection_name, i.trigger_type, i.interval_value,
             a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant
      FROM maintenance_jcn j
      LEFT JOIN aircraft a ON j.aircraft_id = a.id
      LEFT JOIN inspections i ON j.inspection_id = i.id
      WHERE j.id = $1
      `,
      [req.params.id]
    );

    res.json(fullResult.rows[0]);
  } catch (err) {
    console.error("❌ Error updating JCN:", err);
    res.status(500).json({ error: "Failed to update JCN" });
  }
});

// =============================
// CLOSE JCN (shortcut, optionally update corrective action)
// =============================
router.post("/:id/close", async (req, res) => {
  try {
    const { corrective_action } = req.body; // optional

    const updateQuery = `
      UPDATE maintenance_jcn
      SET status = 'CLOSED',
          closed_at = NOW(),
          corrective_action = COALESCE($1, corrective_action)
      WHERE id = $2 AND status = 'OPEN'
      RETURNING id;
    `;

    const updateResult = await pool.query(updateQuery, [
      corrective_action,
      req.params.id,
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "JCN not found or already closed" });
    }

    // fetch full updated JCN
    const fullResult = await pool.query(
      `
      SELECT j.id, j.jcn_no, j.maintenance_type, j.work_unit_code,
             j.discrepancy, j.corrective_action, j.status, j.created_at, j.closed_at,
             j.inspection_id, i.name AS inspection_name, i.trigger_type, i.interval_value,
             a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant
      FROM maintenance_jcn j
      LEFT JOIN aircraft a ON j.aircraft_id = a.id
      LEFT JOIN inspections i ON j.inspection_id = i.id
      WHERE j.id = $1
      `,
      [req.params.id]
    );

    res.json(fullResult.rows[0]);
  } catch (err) {
    console.error("❌ Error closing JCN:", err);
    res.status(500).json({ error: "Failed to close JCN" });
  }
});

module.exports = router;
