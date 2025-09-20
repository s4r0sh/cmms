// index.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import DB
const pool = require("./db");

// Test DB connection on startup
(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("✅ Connected to DB. Time:", res.rows[0].now);
  } catch (err) {
    console.error("❌ DB connection error:", err);
    process.exit(1); // stop server if DB fails
  }
})();

// Routes
app.get("/", (req, res) => {
  res.send("Aviation CMMS backend running 🚀");
});

// Aircraft routes
const aircraftRouter = require("./routes/aircraft");
app.use("/api/aircraft", aircraftRouter);

// Inspections routes
const inspectionsRouter = require("./routes/inspections");
app.use("/api/inspections", inspectionsRouter);

// JCN routes
const jcnsRouter = require("./routes/jcns");
app.use("/api/jcns", jcnsRouter);

// Logistics routes
const logisticsRouter = require("./routes/logistics");
app.use("/api/logistics", logisticsRouter);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
