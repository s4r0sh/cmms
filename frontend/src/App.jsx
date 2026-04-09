import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, AppBar, Toolbar, Typography, Box } from "@mui/material";
import Aircraft from "./components/Aircraft";
import Inspections from "./components/Inspections";
import DefectTrend from "./components/DefectTrend";
import JcnForm from "./components/JcnForm"; // new

const theme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#0a0f1c",
      paper: "#111827",
    },
    primary: { main: "#00fff7" },
    secondary: { main: "#ff00ff" },
  },
  typography: {
    fontFamily: "'Share Tech Mono', monospace",
  },
});

export default function App() {
  const [inspectionHorizon, setInspectionHorizon] = useState(100);
  const [inspections, setInspections] = useState([]);

  const fetchInspections = async () => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/inspections/planning?horizon=${inspectionHorizon}`
      );
      const data = await res.json();
      setInspections(data.map((row, i) => ({ id: i + 1, ...row })));
    } catch (err) {
      console.error("❌ Error fetching inspections:", err);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [inspectionHorizon]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        {/* 🔹 Full-width navbar */}
        <AppBar
          position="static"
          color="transparent"
          sx={{ borderBottom: "2px solid #00fff7" }}
        >
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1, color: "#00fff7" }}>
              PAF Maintenance Management System
            </Typography>
          </Toolbar>
        </AppBar>

        {/* 🔹 Full viewport width content */}
        <Box
          sx={{
            px: 3,
            py: 4,
            width: "100vw",
            maxWidth: "100vw",
            overflowX: "hidden",
          }}
        >
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <Aircraft />
                  <Inspections />
                  <DefectTrend />
                </>
              }
            />
            <Route path="/jcns/new" element={<JcnForm />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}
