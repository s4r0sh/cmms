// Aircraft.jsx
import React, { useEffect, useState, useCallback } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Grid, Button, Box, Typography, Paper } from "@mui/material";

// ✅ Aircraft component
export default function Aircraft({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [squadron, setSquadron] = useState(null);

  // ✅ Fetch aircraft data
  const fetchAircraft = useCallback(() => {
    let url = "http://localhost:5000/api/aircraft";
    if (squadron) url += `?squadron=${squadron}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        // Backend already clusters by tail_number and sorts JCNS by created_at
        setRows(
          data.map((jcn, index) => ({
            id: index + 1,
            tail_number: jcn.tail_number,
            type: jcn.type,
            variant: jcn.variant,
            reason: jcn.reason,
            time: jcn.time,
            details: jcn.details || "",
          }))
        );
      })
      .catch((err) => console.error("❌ Error fetching aircraft:", err));
  }, [squadron]);

  // ✅ Run fetch on squadron change OR refresh trigger
  useEffect(() => {
    fetchAircraft();
  }, [squadron, refreshKey, fetchAircraft]);

  // ✅ Polling every 2 seconds
  useEffect(() => {
    const interval = setInterval(fetchAircraft, 2000);
    return () => clearInterval(interval);
  }, [fetchAircraft]);

  // ✅ Columns aligned with backend
  const columns = [
    { field: "tail_number", headerName: "Tail Number", flex: 1, minWidth: 150 },
    { field: "type", headerName: "Type", flex: 1, minWidth: 80 },
    { field: "variant", headerName: "Variant", flex: 1, minWidth: 120 },
    { field: "reason", headerName: "Reason", flex: 1, minWidth: 120 },
    { field: "time", headerName: "Time", flex: 1, minWidth: 180 },
    { field: "details", headerName: "Details", flex: 1, minWidth: 380 },
  ];

  return (
    <Paper sx={{ p: 2, mb: 4, bgcolor: "background.paper" }}>
      <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
        Aircraft Overview
      </Typography>
      <Grid container spacing={2}>
        {/* Table on left */}
        <Grid xs={9}>
          <div style={{ height: 400, width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              pageSize={5}
              // Removed initialState.sorting since backend handles it
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

        {/* Filters on right */}
        <Grid xs={3}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Typography variant="subtitle1" sx={{ color: "secondary.main" }}>
              Squadron Filter
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setSquadron("Sqn 39")}
            >
              Squadron 39
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setSquadron("Sqn 49")}
            >
              Squadron 49
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={() => setSquadron("Sqn 51")}
            >
              Squadron 51
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}

// ✅ Helper hook for refresh control
export function useAircraftRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((k) => k + 1);
  return { refreshKey, triggerRefresh };
}
