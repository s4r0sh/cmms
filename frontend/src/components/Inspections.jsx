import React, { useEffect, useState, useCallback } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import {
  Grid,
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

export default function Inspections() {
  const [rows, setRows] = useState([]);
  const [horizon, setHorizon] = useState(100);
  const [squadron, setSquadron] = useState(null);

  const fetchInspections = useCallback(() => {
    let url = `http://localhost:5000/api/inspections/planning?horizon=${horizon}`;
    if (squadron) url += `&squadron=${encodeURIComponent(squadron)}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRows(data.map((row, index) => ({ id: index + 1, ...row })));
        } else {
          console.error("❌ Unexpected response:", data);
          setRows([]);
        }
      })

      .catch((err) => console.error("❌ Error fetching inspections:", err));
  }, [horizon, squadron]);

  // Initial + horizon change
  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  // ✅ Polling every 2s
  useEffect(() => {
    const interval = setInterval(fetchInspections, 2000);
    return () => clearInterval(interval);
  }, [fetchInspections]);

  const closeJCN = async (jcnId) => {
    await fetch(`http://localhost:5000/api/jcns/${jcnId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    fetchInspections(); // refresh inspections table
  };

  const columns = [
    { field: "tail_number", headerName: "Tail Number", flex: 1, minWidth: 150 },
    { field: "type", headerName: "Type", flex: 1, minWidth: 80 },
    { field: "variant", headerName: "Variant", flex: 1, minWidth: 120 },
    {
      field: "inspection_name",
      headerName: "Inspection",
      flex: 1,
      minWidth: 280,
    },
    { field: "trigger_type", headerName: "Trigger", flex: 1, minWidth: 150 },
    { field: "interval_value", headerName: "Interval", flex: 1, minWidth: 120 },
    {
      field: "remaining_until_due",
      headerName: "Remaining",
      flex: 1,
      minWidth: 120,
    },
  ];

  return (
    <Paper sx={{ p: 2, mb: 4, bgcolor: "background.paper" }}>
      <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
        Upcoming Inspections
      </Typography>
      <Grid container spacing={2}>
        {/* Table on left */}
        <Grid xs={9}>
          <div style={{ height: 400, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSize={5}
              slots={{ toolbar: GridToolbar }}
              sx={{
                border: "1px solid #ff00ff",
                color: "#fff",
                "& .MuiDataGrid-columnHeaders": {
                  backgroundColor: "#1f2937",
                  color: "#ff00ff",
                },
              }}
            />
          </div>
        </Grid>

        {/* Horizon filter on right */}
        <Grid xs={3}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Typography variant="subtitle1" sx={{ color: "secondary.main" }}>
              Squadron Filter
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="squadron-label" sx={{ color: "#fff" }}>
                Squadron
              </InputLabel>
              <Select
                labelId="squadron-label"
                value={squadron || ""}
                onChange={(e) => setSquadron(e.target.value)}
                sx={{ color: "#fff" }}
              >
                <MenuItem value="">All Sqns</MenuItem>
                <MenuItem value="Sqn 39">Sqn 39</MenuItem>
                <MenuItem value="Sqn 49">Sqn 49</MenuItem>
                <MenuItem value="Sqn 51">Sqn 51</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="subtitle1" sx={{ color: "secondary.main" }}>
              Forecast Horizon
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="horizon-label" sx={{ color: "#fff" }}>
                Horizon
              </InputLabel>
              <Select
                labelId="horizon-label"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
                sx={{ color: "#fff" }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value={30}>30 units</MenuItem>
                <MenuItem value={60}>60 units</MenuItem>
                <MenuItem value={90}>90 units</MenuItem>
                <MenuItem value={100}>100 units</MenuItem>
                <MenuItem value={180}>180 units</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
