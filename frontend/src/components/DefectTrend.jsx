// src/components/DefectTrend.jsx
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
  TextField,
} from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";

import dayjs from "dayjs";
import { ataCodes, ataName } from "../utils/ataCodes";

export default function DefectTrend() {
  const [rows, setRows] = useState([]);
  const [squadron, setSquadron] = useState("");
  const [horizon, setHorizon] = useState(30);
  const [customStart, setCustomStart] = useState(null);
  const [topSystems, setTopSystems] = useState([]);
  const [topAircraft, setTopAircraft] = useState([]);
  const [filterWuc, setFilterWuc] = useState(null);
  const [filterTail, setFilterTail] = useState(null);

  const [customEnd, setCustomEnd] = useState(null);

  const [avgByType, setAvgByType] = useState([]);

  const fetchAvgByType = useCallback(() => {
    let url = `http://localhost:5000/api/defects/avg-by-type?horizon=${horizon}`;
    if (squadron) url += `&squadron=${encodeURIComponent(squadron)}`;
    if (horizon === "custom" && customStart && customEnd)
      url += `&start=${customStart}&end=${customEnd}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => setAvgByType(data))
      .catch((err) =>
        console.error("❌ Error fetching avg defects by type:", err)
      );
  }, [squadron, horizon, customStart, customEnd]);

  const fetchDefects = useCallback(() => {
    let url = `http://localhost:5000/api/defects?horizon=${horizon}`;
    if (squadron) url += `&squadron=${encodeURIComponent(squadron)}`;
    if (horizon === "custom" && customStart && customEnd) {
      url += `&start=${customStart}&end=${customEnd}`;
    }

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const formatted = data.map((item, index) => ({
            id: index + 1,
            tail_number: item.tail_number,
            type: item.aircraft_type,
            variant: item.aircraft_variant,
            wuc: ataName(item.wuc),
            discrepancy: item.discrepancy,
            corrective_action: item.corrective_action || "Pending",
          }));
          setRows(formatted);
        } else {
          console.error("❌ Unexpected response:", data);
          setRows([]);
        }
      })
      .catch((err) => console.error("❌ Error fetching defects:", err));
  }, [squadron, horizon, customStart, customEnd]);

  const fetchTopSystems = useCallback(() => {
    let url = `http://localhost:5000/api/defects/top-systems?horizon=${horizon}`;
    if (squadron) url += `&squadron=${encodeURIComponent(squadron)}`;
    if (horizon === "custom" && customStart && customEnd)
      url += `&start=${customStart}&end=${customEnd}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => setTopSystems(data))
      .catch((err) => console.error("❌ Error fetching top systems:", err));
  }, [squadron, horizon, customStart, customEnd]);

  const fetchTopAircraft = useCallback(() => {
    let url = `http://localhost:5000/api/defects/top-aircraft?horizon=${horizon}`;
    if (squadron) url += `&squadron=${encodeURIComponent(squadron)}`;
    if (horizon === "custom" && customStart && customEnd)
      url += `&start=${customStart}&end=${customEnd}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => setTopAircraft(data))
      .catch((err) => console.error("❌ Error fetching top aircraft:", err));
  }, [squadron, horizon, customStart, customEnd]);

  // ✅ Initial fetch + re-fetch on dependency change
  useEffect(() => {
    fetchDefects();
    fetchTopSystems();
    fetchTopAircraft();
  }, [fetchDefects, fetchTopSystems, fetchTopAircraft]);

  // ✅ Polling every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDefects();
      fetchTopSystems();
      fetchTopAircraft();
      fetchAvgByType(); // ✅ added
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchDefects, fetchTopSystems, fetchTopAircraft, fetchAvgByType]);

  // ✅ Reset filters when query parameters change
  useEffect(() => {
    setFilterWuc(null);
    setFilterTail(null);
  }, [squadron, horizon, customStart, customEnd]);

  // ✅ Apply filters to defect table
  const filteredRows = rows.filter((row) => {
    if (filterWuc) return row.wuc === ataName(filterWuc);
    if (filterTail) return row.tail_number === filterTail;
    return true;
  });

  // ✅ Columns definition
  const columns = [
    { field: "tail_number", headerName: "Tail Number", flex: 1, minWidth: 150 },
    { field: "type", headerName: "Type", flex: 1, minWidth: 80 },
    { field: "variant", headerName: "Variant", flex: 1, minWidth: 120 },
    { field: "wuc", headerName: "WUC", flex: 1, minWidth: 100 },
    { field: "discrepancy", headerName: "Defect", flex: 2, minWidth: 280 },
    {
      field: "corrective_action",
      headerName: "Corrective Action",
      flex: 2,
      minWidth: 280,
    },
  ];

  return (
    <Paper sx={{ p: 2, mb: 4, bgcolor: "background.paper" }}>
      <Typography variant="h6" sx={{ mb: 2, color: "primary.main" }}>
        Defect Trend
      </Typography>

      <Grid container spacing={2}>
        {/* Table section */}
        <Grid xs={9}>
          <div style={{ height: 400, width: "100%" }}>
            <DataGrid
              rows={filteredRows}
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

        {/* Filters */}
        <Grid xs={3}>
          <Box display="flex" flexDirection="column" gap={2}>
            {/* Squadron Filter */}
            <Typography variant="subtitle1" sx={{ color: "secondary.main" }}>
              Squadron Filter
            </Typography>
            <FormControl fullWidth>
              <InputLabel id="squadron-label" sx={{ color: "#fff" }}>
                Squadron
              </InputLabel>
              <Select
                labelId="squadron-label"
                value={squadron}
                onChange={(e) => setSquadron(e.target.value)}
                sx={{ color: "#fff" }}
              >
                <MenuItem value="">All Sqns</MenuItem>
                <MenuItem value="Sqn 39">Sqn 39</MenuItem>
                <MenuItem value="Sqn 49">Sqn 49</MenuItem>
                <MenuItem value="Sqn 51">Sqn 51</MenuItem>
              </Select>
            </FormControl>

            {/* Horizon Filter */}
            <Typography variant="subtitle1" sx={{ color: "secondary.main" }}>
              Horizon Filter
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
                <MenuItem value={30}>Last 30 days</MenuItem>
                <MenuItem value={60}>Last 60 days</MenuItem>
                <MenuItem value={90}>Last 90 days</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>

            {/* Custom Date Picker */}
            {horizon === "custom" && (
              <>
                <TextField
                  type="date"
                  label="Start Date"
                  value={customStart || ""}
                  onChange={(e) => setCustomStart(e.target.value)}
                  InputLabelProps={{ shrink: true, style: { color: "#fff" } }}
                  sx={{ input: { color: "#fff" } }}
                />
                <TextField
                  type="date"
                  label="End Date"
                  value={customEnd || ""}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  InputLabelProps={{ shrink: true, style: { color: "#fff" } }}
                  sx={{ input: { color: "#fff" } }}
                />
              </>
            )}
          </Box>
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mt: 3 }}>
        <Grid item xs={4}>
          <Paper sx={{ p: 2, bgcolor: "#1f2937" }}>
            <Typography sx={{ color: "#ff00ff", mb: 1 }}>
              Top 3 Defective Systems
            </Typography>
            <BarChart
              height={300}
              series={[
                {
                  data: topSystems.map((s) => Number(s.count)),
                  label: "Count",
                  color: "#ff00ff",
                },
              ]}
              xAxis={[
                {
                  data: topSystems.map((s) => ataName(s.wuc)),
                  scaleType: "band",
                },
              ]}
              onItemClick={(event, d) => {
                if (d.dataIndex !== undefined) {
                  const clickedWuc = topSystems[d.dataIndex].wuc;
                  setFilterWuc(clickedWuc);
                  setFilterTail(null); // clear other filter
                }
              }}
            />
          </Paper>
        </Grid>

        <Grid item xs={4}>
          <Paper sx={{ p: 2, bgcolor: "#1f2937" }}>
            <Typography sx={{ color: "#00ffff", mb: 1 }}>
              Top 3 Defective Aircraft
            </Typography>
            <BarChart
              height={300}
              series={[
                {
                  data: topAircraft.map((a) => Number(a.count)),
                  label: "Count",
                  color: "#00ffff",
                },
              ]}
              xAxis={[
                {
                  data: topAircraft.map((a) => a.tail_number),
                  scaleType: "band",
                },
              ]}
              onItemClick={(event, d) => {
                if (d.dataIndex !== undefined) {
                  const clickedTail = topAircraft[d.dataIndex].tail_number;
                  setFilterTail(clickedTail);
                  setFilterWuc(null); // clear other filter
                }
              }}
            />
          </Paper>
        </Grid>
        {/* ✅ NEW: Average Defects per Aircraft Type */}
        <Grid item xs={4}>
          <Paper sx={{ p: 2, bgcolor: "#1f2937" }}>
            <Typography sx={{ color: "#ffcc00", mb: 1 }}>
              Avg Defects per Aircraft Type
            </Typography>
            <BarChart
              height={300}
              series={[
                {
                  data: avgByType.map((t) => Number(t.avg_defects)),
                  label: "Avg Defects",
                  color: "#ffcc00",
                },
              ]}
              xAxis={[
                {
                  data: avgByType.map((t) => t.aircraft_type),
                  scaleType: "band",
                },
              ]}
            />
          </Paper>
        </Grid>
      </Grid>
    </Paper>
  );
}
