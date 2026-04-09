// Aircraft.jsx
import React, { useEffect, useState, useCallback } from "react";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import {
  Grid,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Paper,
} from "@mui/material";

import { BarChart } from "@mui/x-charts/BarChart";

// ✅ Aircraft component
export default function Aircraft({ refreshKey }) {
  const [rows, setRows] = useState([]);
  const [squadron, setSquadron] = useState(null);
  const [reason, setReason] = useState(null);
  const [statusSummary, setStatusSummary] = useState([]);

  // ✅ Compute summary either for selected Sqn or overall fleet
  const selectedSummary = squadron
    ? statusSummary.find((s) => s.squadron === squadron)
    : statusSummary.length
    ? statusSummary.reduce(
        (acc, s) => ({
          squadron: "All Sqns",
          serviceable: acc.serviceable + Number(s.serviceable || 0),
          scheduled: acc.scheduled + Number(s.scheduled || 0),
          unscheduled: acc.unscheduled + Number(s.unscheduled || 0),
          micap: acc.micap + Number(s.micap || 0),
          allotted_out: acc.allotted_out + Number(s.allotted_out || 0),
        }),
        {
          squadron: "All Sqns",
          serviceable: 0,
          scheduled: 0,
          unscheduled: 0,
          micap: 0,
          allotted_out: 0,
        }
      )
    : null;

  const total =
    selectedSummary &&
    Number(selectedSummary.serviceable) +
      Number(selectedSummary.scheduled) +
      Number(selectedSummary.unscheduled) +
      Number(selectedSummary.micap) +
      Number(selectedSummary.allotted_out);

  const serviceabilityRate =
    selectedSummary && total
      ? (selectedSummary.serviceable / total) * 100
      : null;
  const scheduledRate =
    selectedSummary && total ? (selectedSummary.scheduled / total) * 100 : null;
  const unscheduledRate =
    selectedSummary && total
      ? (selectedSummary.unscheduled / total) * 100
      : null;
  const micapRate =
    selectedSummary && total ? (selectedSummary.micap / total) * 100 : null;
  const allottedOutRate =
    selectedSummary && total
      ? (selectedSummary.allotted_out / total) * 100
      : null;

  const fetchStatusSummary = useCallback(() => {
    fetch("http://localhost:5000/api/aircraft/status-summary")
      .then((res) => res.json())
      .then((data) => setStatusSummary(data))
      .catch((err) =>
        console.error("❌ Error fetching squadron summary:", err)
      );
  }, []);

  // ✅ Fetch aircraft data
  const fetchAircraft = useCallback(() => {
    let url = "http://localhost:5000/api/aircraft";
    const params = [];
    if (squadron) params.push(`squadron=${squadron}`);
    if (reason) params.push(`reason=${reason}`);
    if (params.length) url += `?${params.join("&")}`;

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
  }, [squadron, reason]);

  // ✅ Run fetch on squadron change OR refresh trigger
  useEffect(() => {
    fetchAircraft();
    fetchStatusSummary();
  }, [squadron, reason, refreshKey, fetchAircraft, fetchStatusSummary]);

  //Poll every 2 seconds

  useEffect(() => {
    const interval = setInterval(() => {
      fetchAircraft();
      fetchStatusSummary();
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchAircraft, fetchStatusSummary]);

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
            {/* 🔹 Unserviceability Reason Filter */}
            <Typography variant="subtitle1" sx={{ color: "secondary.main" }}>
              Unserviceability Reason
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="reason-label" sx={{ color: "#fff" }}>
                Reason
              </InputLabel>
              <Select
                labelId="reason-label"
                value={reason || ""} // You'll need a new state: const [reason, setReason] = useState(null);
                onChange={(e) => setReason(e.target.value)}
                sx={{ color: "#fff" }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="unscheduled">Unscheduled</MenuItem>
                <MenuItem value="micap" disabled>
                  MICAP
                </MenuItem>
                <MenuItem value="allotted_out" disabled>
                  Allotted Out
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Grid>
      </Grid>

      <Grid
        container
        spacing={2}
        sx={{
          mt: 4,
          alignItems: "stretch",
          display: "flex",
          flexWrap: "nowrap", // ✅ prevents wrapping
          overflowX: "auto", // ✅ allows scroll if needed on smaller screens
        }}
      >
        {statusSummary.map((sqn, idx) => {
          const colors = ["#00ffff", "#ff00ff", "#ffcc00"];
          const color = colors[idx % colors.length];
          return (
            <Grid item xs={2.8} key={idx} sx={{ flex: "1 1 auto" }}>
              <Paper sx={{ p: 2, bgcolor: "#1f2937", height: "100%" }}>
                <Typography sx={{ color, mb: 1 }}>{sqn.squadron}</Typography>
                <BarChart
                  height={300}
                  series={[
                    {
                      data: [
                        Number(sqn.scheduled),
                        Number(sqn.unscheduled),
                        Number(sqn.micap),
                        Number(sqn.allotted_out),
                      ],
                      label: "Aircraft Count",
                      color,
                    },
                  ]}
                  xAxis={[
                    {
                      data: ["Sch", "Unsch", "MICAP", "A/O"],
                      scaleType: "band",
                    },
                  ]}
                  yAxis={[
                    {
                      tickMinStep: 1,
                      valueFormatter: (v) => Math.floor(v),
                    },
                  ]}
                />
              </Paper>
            </Grid>
          );
        })}

        {selectedSummary && (
          <Grid item xs={2.5}>
            <Paper
              sx={{
                p: 3,
                bgcolor: "#1f2937",
                color: "#fff",
                textAlign: "center",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {/* ✅ Main Rate */}
              <Typography
                variant="h2"
                sx={{
                  color: "#00ff00",
                  fontWeight: 900,
                  lineHeight: 1.1,
                  mb: 1.5,
                }}
              >
                {serviceabilityRate
                  ? `${serviceabilityRate.toFixed(1)}%`
                  : "--"}
              </Typography>

              {/* ✅ Subtext: Serviceability Rate + Squadron name */}
              <Typography
                variant="body2"
                sx={{
                  color: "#bbb",
                  mb: 3,
                  fontStyle: "italic",
                }}
              >
                Serviceability Rate — {selectedSummary.squadron}
              </Typography>

              {/* ✅ Divider Line */}
              <Box
                sx={{
                  width: "60%",
                  height: "1px",
                  backgroundColor: "#444",
                  mb: 3,
                }}
              />

              {/* ✅ Breakdown Section */}
              <Box sx={{ textAlign: "left", width: "100%", maxWidth: 180 }}>
                <Typography sx={{ color: "#ffcc00" }}>
                  Scheduled:{" "}
                  {scheduledRate ? `${scheduledRate.toFixed(1)}%` : "--"}
                </Typography>
                <Typography sx={{ color: "#ff00ff" }}>
                  Unscheduled:{" "}
                  {unscheduledRate ? `${unscheduledRate.toFixed(1)}%` : "--"}
                </Typography>
                <Typography sx={{ color: "#ff6600" }}>
                  MICAP: {micapRate ? `${micapRate.toFixed(1)}%` : "--"}
                </Typography>
                <Typography sx={{ color: "#00bfff" }}>
                  Allotted Out:{" "}
                  {allottedOutRate ? `${allottedOutRate.toFixed(1)}%` : "--"}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        )}
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
