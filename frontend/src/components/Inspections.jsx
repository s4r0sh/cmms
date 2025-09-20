import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    fetch(`http://localhost:5000/api/inspections/planning?horizon=${horizon}`)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.map((row, index) => ({ id: index + 1, ...row })));
      })
      .catch((err) => console.error("❌ Error fetching inspections:", err));
  }, [horizon]);

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
        <Grid item xs={9}>
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
        <Grid item xs={3}>
          <Box display="flex" flexDirection="column" gap={2}>
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
                <MenuItem value={30}>30 days</MenuItem>
                <MenuItem value={60}>60 days</MenuItem>
                <MenuItem value={90}>90 days</MenuItem>
                <MenuItem value={100}>100 days</MenuItem>
                <MenuItem value={180}>180 days</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
