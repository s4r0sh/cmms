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
// GET all OPEN JCNS
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
// GET all inspections with next due
// =============================
router.get("/inspections", async (req, res) => {
  try {
    const { aircraft_id } = req.query;

    const result = await pool.query(
      `
SELECT i.id, i.name, i.trigger_type, i.interval_value,
       COALESCE(
         CASE
           WHEN i.trigger_type='FH' THEN ih.fh_at_inspection + i.interval_value
           WHEN i.trigger_type='FC' THEN ih.fc_at_inspection + i.interval_value
           WHEN i.trigger_type='FL' THEN ih.fl_at_inspection + i.interval_value
           WHEN i.trigger_type='CALENDAR' THEN ih.performed_on + (i.interval_value || ' days')::interval
         END,
         -- fallback for inspections not in history yet
         CASE
           WHEN i.trigger_type='FH' THEN a.current_fh + i.interval_value
           WHEN i.trigger_type='FC' THEN a.current_fc + i.interval_value
           WHEN i.trigger_type='FL' THEN a.current_fl + i.interval_value
           WHEN i.trigger_type='CALENDAR' THEN NOW() + (i.interval_value || ' days')::interval
         END
       ) AS next_due
FROM inspections i
JOIN aircraft a ON a.id = $1
LEFT JOIN inspection_history ih
       ON i.id = ih.inspection_id AND ih.aircraft_id = $1
WHERE i.is_custom = FALSE
   OR i.id IN (
       SELECT inspection_id FROM maintenance_jcn
       WHERE aircraft_id = $1
   )
ORDER BY next_due
      `,
      [aircraft_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching inspections:", err);
    res.status(500).json({ error: "Database error" });
  }
});

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

      // ✅ Check if identical custom inspection already exists
      const existing = await pool.query(
        `SELECT id FROM inspections
     WHERE name = $1 AND trigger_type = $2 AND interval_value = $3 AND is_custom = TRUE`,
        [custom_inspection_name, custom_trigger_type, intervalInt]
      );

      if (existing.rows.length > 0) {
        inspection_id = existing.rows[0].id;
        console.log("♻️ Reusing existing custom inspection id:", inspection_id);
      } else {
        // Create new custom inspection if not found
        const customInsert = await pool.query(
          `INSERT INTO inspections (name, trigger_type, interval_value, is_custom)
        VALUES ($1, $2, $3, TRUE) RETURNING id`,
          [custom_inspection_name, custom_trigger_type, intervalInt]
        );
        inspection_id = customInsert.rows[0].id;
        console.log("✅ Some problem is there:", inspection_id);
      }
    }

    // -------------------------------
    // 2️⃣ Duplicate check for scheduled inspections
    // -------------------------------
    if (maintenance_type === "scheduled" && inspection_id) {
      const duplicateCheck = await pool.query(
        `SELECT id FROM maintenance_jcn
         WHERE aircraft_id = $1 AND inspection_id = $2 AND status = 'OPEN'`,
        [aircraft_id, inspection_id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(400).json({
          error:
            "A JCN for this scheduled inspection is already open for this aircraft",
        });
      }
    }

    // Insert JCN
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

    // 🔹 Update aircraft to unserviceable
    if (!close) {
      await pool.query(
        `
      UPDATE aircraft
      SET operational_status = 'unserviceable',
          unserviceable_reason = $1,
          details = $2
      WHERE id = $3
    `,
        [maintenance_type, corrective_action || "Pending", aircraft_id]
      );
    }

    // Return full inserted JCN
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
// =============================
// UPDATE JCN (corrective action / close)
// =============================
router.put("/:id", async (req, res) => {
  try {
    const { corrective_action, close } = req.body;

    // Update corrective action & optionally close
    const updateQuery = close
      ? `
        UPDATE maintenance_jcn
        SET corrective_action = COALESCE($1, corrective_action),
            status = 'CLOSED',
            closed_at = NOW()
        WHERE id = $2 AND status = 'OPEN'
        RETURNING aircraft_id;
      `
      : `
        UPDATE maintenance_jcn
        SET corrective_action = COALESCE($1, corrective_action)
        WHERE id = $2 AND status = 'OPEN'
        RETURNING aircraft_id;
      `;

    const updateResult = await pool.query(updateQuery, [
      corrective_action,
      req.params.id,
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: "JCN not found or already closed" });
    }

    const aircraft_id = updateResult.rows[0].aircraft_id;

    // 🔹 If JCN is closed, check if aircraft can be marked serviceable
    if (close) {
      const openJcns = await pool.query(
        `SELECT COUNT(*) FROM maintenance_jcn
         WHERE aircraft_id=$1 AND status='OPEN'`,
        [aircraft_id]
      );

      if (parseInt(openJcns.rows[0].count) === 0) {
        await pool.query(
          `UPDATE aircraft
           SET operational_status='serviceable',
               unserviceable_reason=NULL,
               details=NULL
           WHERE id=$1`,
          [aircraft_id]
        );
      }
    }

    // Return updated JCN
    const fullResult = await pool.query(
      `SELECT j.id, j.jcn_no, j.maintenance_type, j.work_unit_code,
              j.discrepancy, j.corrective_action, j.status, j.created_at, j.closed_at,
              j.inspection_id, i.name AS inspection_name, i.trigger_type, i.interval_value,
              a.tail_number, a.type AS aircraft_type, a.variant AS aircraft_variant
       FROM maintenance_jcn j
       LEFT JOIN aircraft a ON j.aircraft_id = a.id
       LEFT JOIN inspections i ON j.inspection_id = i.id
       WHERE j.id = $1`,
      [req.params.id]
    );

    res.json(fullResult.rows[0]);
  } catch (err) {
    console.error("❌ Error updating JCN:", err);
    res.status(500).json({ error: "Failed to update JCN" });
  }
});

// =============================
// CLOSE JCN (shortcut)
// =============================
router.post("/:id/close", async (req, res) => {
  try {
    const { corrective_action } = req.body;

    // Get JCN with its aircraft
    const jcnResult = await pool.query(
      `SELECT id, aircraft_id, inspection_id
       FROM maintenance_jcn
       WHERE id=$1 AND status='OPEN'`,
      [req.params.id]
    );

    if (jcnResult.rows.length === 0) {
      return res.status(404).json({ error: "JCN not found or already closed" });
    }

    const { aircraft_id, inspection_id } = jcnResult.rows[0];

    // Close the JCN
    await pool.query(
      `UPDATE maintenance_jcn
       SET status='CLOSED',
           closed_at=NOW(),
           corrective_action=COALESCE($1, corrective_action)
       WHERE id=$2`,
      [corrective_action, req.params.id]
    );

    if (inspection_id) {
      // Fetch inspection type
      const insRes = await pool.query(
        `SELECT trigger_type FROM inspections WHERE id=$1`,
        [inspection_id]
      );

      if (insRes.rows.length) {
        const trigger_type = insRes.rows[0].trigger_type.toUpperCase();

        // Fetch current aircraft counters
        const acRes = await pool.query(
          `SELECT current_fh, current_fc, current_fl FROM aircraft WHERE id=$1`,
          [aircraft_id]
        );
        const ac = acRes.rows[0];

        let column, value;
        if (trigger_type === "CALENDAR") {
          column = "performed_on";
          value = new Date();
        } else if (trigger_type === "FH") {
          column = "fh_at_inspection";
          value = ac.current_fh;
        } else if (trigger_type === "FC") {
          column = "fc_at_inspection";
          value = ac.current_fc;
        } else if (trigger_type === "FL") {
          column = "fl_at_inspection";
          value = ac.current_fl;
        }

        // Insert or update inspection_history
        await pool.query(
          `INSERT INTO inspection_history (aircraft_id, inspection_id, ${column})
       VALUES ($1, $2, $3)
       ON CONFLICT (aircraft_id, inspection_id) DO UPDATE
       SET ${column} = EXCLUDED.${column}`,
          [aircraft_id, inspection_id, value]
        );

        console.log(
          `✅ Inspection history updated for inspection ${inspection_id}`
        );
      }
    }

    // Check if other open JCNS exist for this aircraft
    const openJcns = await pool.query(
      `SELECT COUNT(*) FROM maintenance_jcn
       WHERE aircraft_id=$1 AND status='OPEN'`,
      [aircraft_id]
    );

    if (parseInt(openJcns.rows[0].count) === 0) {
      // No open JCNS left → mark aircraft serviceable again
      await pool.query(
        `UPDATE aircraft
         SET operational_status='serviceable',
             unserviceable_reason=NULL,
             details=NULL
         WHERE id=$1`,
        [aircraft_id]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error closing JCN:", err);
    res.status(500).json({ error: "Failed to close JCN" });
  }
});

module.exports = router;
