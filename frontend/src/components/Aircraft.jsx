import React, { useEffect, useState } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Grid, Button, Box, Typography, Paper } from "@mui/material";

export default function Aircraft() {
  const [rows, setRows] = useState([]);
  // ✅ State for squadron filter
  const [squadron, setSquadron] = useState(null);

  // ✅ Fetch with squadron filter
  useEffect(() => {
    let url = "http://localhost:5000/api/aircraft";
    if (squadron) {
      url += `?squadron=${squadron}`;
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setRows(data.map((row, index) => ({ id: index + 1, ...row })));
      })
      .catch((err) => console.error("❌ Error fetching aircraft:", err));
  }, [squadron]);

  useEffect(() => {
    fetch("http://localhost:5000/api/aircraft")
      .then((res) => res.json())
      .then((data) => {
        setRows(data.map((row, index) => ({ id: index + 1, ...row })));
      })
      .catch((err) => console.error("❌ Error fetching aircraft:", err));
  }, []);

  const columns = [
    { field: "tail_number", headerName: "Tail Number", flex: 1, minWidth: 150 },
    { field: "type", headerName: "Type", flex: 1, minWidth: 80 },
    { field: "variant", headerName: "Variant", flex: 1, minWidth: 120 },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      minWidth: 150,
    },
    { field: "reason", headerName: "Reason", flex: 1, minWidth: 120 },
    { field: "details", headerName: "Details", flex: 1, minWidth: 400 },
  ];

  return (
    <Paper sx={{ p: 2, mb: 4, bgcolor: "background.paper" }}>
      <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
        Aircraft Overview
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

        {/* Filters on right */}
        <Grid item xs={3}>
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
