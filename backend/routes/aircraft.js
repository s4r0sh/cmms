// routes/aircraft.js
const express = require("express");
const router = express.Router();
const pool = require("../db");

// // GET all aircraft
// router.get("/", async (req, res) => {
//   try {
//     const result = await pool.query(`
//       SELECT id, type, variant, tail_number, current_fh, current_fc, current_fl
//       FROM aircraft
//       ORDER BY tail_number;
//     `);
//     res.json(result.rows);
//   } catch (err) {
//     console.error("❌ Error fetching aircraft:", err);
//     res.status(500).json({ error: "Failed to fetch aircraft" });
//   }
// });

// GET all unserviceable aircraft
router.get("/", async (req, res) => {
  try {
    const { squadron } = req.query;

    const baseQuery = `
      SELECT id, tail_number, type, variant,
             operational_status AS status,
             unserviceable_reason AS reason,
             details,
             squadron
      FROM aircraft
      WHERE operational_status = 'unserviceable'
    `;

    const finalQuery = squadron
      ? baseQuery + ` AND TRIM(squadron) ILIKE $1 ORDER BY tail_number`
      : baseQuery + ` ORDER BY squadron, tail_number`;

    const result = squadron
      ? await pool.query(finalQuery, [`%${squadron}%`])
      : await pool.query(finalQuery);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching aircraft overview:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET single aircraft by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT id, type, variant, tail_number, current_fh, current_fc, current_fl
      FROM aircraft
      WHERE id = $1;
      `,
      [id]
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
