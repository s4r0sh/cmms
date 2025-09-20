// routes/logistics.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET all demands with JCN and aircraft info
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        d.id AS demand_id,
        d.jcn_id,
        j.jcn_no,
        j.maintenance_type,
        j.work_unit_code,
        d.component_id,
        c.part_number,
        c.nomenclature,
        d.quantity,
        d.status AS demand_status,
        d.created_at AS demand_created_at,
        a.tail_number,
        a.type AS aircraft_type,
        a.variant AS aircraft_variant
      FROM maintenance_demands d
      LEFT JOIN maintenance_jcn j ON d.jcn_id = j.id
      LEFT JOIN aircraft a ON j.aircraft_id = a.id
      LEFT JOIN components c ON d.component_id = c.id
      ORDER BY d.status, d.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching demands:", err);
    res.status(500).json({ error: "Failed to fetch demands" });
  }
});

// PATCH update demand status
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body; // Expecting: 'ISSUED' or 'NOT AVAILABLE'
    if (!["ISSUED", "NOT AVAILABLE", "PENDING"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await pool.query(
      `UPDATE maintenance_demands
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Demand not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating demand:", err);
    res.status(500).json({ error: "Failed to update demand status" });
  }
});

module.exports = router;
