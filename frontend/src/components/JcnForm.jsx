import React, { useState, useEffect } from "react";
import {
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";

export default function JcnForm() {
  const [mode, setMode] = useState("create");
  const [jcnNo, setJcnNo] = useState("");
  const [aircraftId, setAircraftId] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [inspections, setInspections] = useState([]);
  const [inspectionId, setInspectionId] = useState("");
  const [discrepancy, setDiscrepancy] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [aircraft, setAircraft] = useState([]);
  const [jcns, setJcns] = useState([]);
  const [selectedJcn, setSelectedJcn] = useState("");
  const [selectedJcnData, setSelectedJcnData] = useState(null);

  useEffect(() => {
    fetch("http://localhost:5000/api/aircraft")
      .then((res) => res.json())
      .then(setAircraft)
      .catch((err) => console.error("Error loading aircraft:", err));
  }, []);

  useEffect(() => {
    if (maintenanceType === "scheduled") {
      fetch("http://localhost:5000/api/inspections")
        .then((res) => res.json())
        .then(setInspections)
        .catch((err) => console.error("Error loading inspections:", err));
    } else {
      setInspectionId("");
      setInspections([]);
    }
  }, [maintenanceType]);

  useEffect(() => {
    if (mode === "update") {
      fetch("http://localhost:5000/api/jcns?status=OPEN")
        .then((res) => res.json())
        .then(setJcns)
        .catch((err) => console.error("Error loading JCNs:", err));
    }
  }, [mode]);

  useEffect(() => {
    if (selectedJcn) {
      const jcn = jcns.find((j) => String(j.id) === String(selectedJcn));
      if (jcn) {
        setSelectedJcnData(jcn);
        setJcnNo(jcn.jcn_no || "");
        setAircraftId(jcn.aircraft_id ? String(jcn.aircraft_id) : "");
        setMaintenanceType(jcn.maintenance_type || "");
        setDiscrepancy(jcn.discrepancy || "");
        setCorrectiveAction(jcn.corrective_action || "");
        setInspectionId(jcn.inspection_id ? String(jcn.inspection_id) : "");
      }
    } else {
      setSelectedJcnData(null);
      setJcnNo("");
      setAircraftId("");
      setMaintenanceType("");
      setDiscrepancy("");
      setCorrectiveAction("");
      setInspectionId("");
    }
  }, [selectedJcn, jcns]);

  const resetForm = () => {
    setMode("create");
    setSelectedJcn("");
    setSelectedJcnData(null);
    setJcnNo("");
    setAircraftId("");
    setMaintenanceType("");
    setDiscrepancy("");
    setCorrectiveAction("");
    setInspectionId("");
  };

  const saveJcn = async (close = false) => {
    const payload = {
      jcn_no: jcnNo,
      aircraft_id: aircraftId ? parseInt(aircraftId, 10) : null,
      maintenance_type: maintenanceType,
      discrepancy: discrepancy || null,
      corrective_action: correctiveAction || null,
      inspection_id:
        maintenanceType === "scheduled" && inspectionId
          ? parseInt(inspectionId, 10)
          : null,
      close,
    };

    const url =
      mode === "create"
        ? "http://localhost:5000/api/jcns"
        : `http://localhost:5000/api/jcns/${selectedJcn}${
            close ? "/close" : ""
          }`;

    const method = mode === "create" || close ? "POST" : "PUT";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert(
          `✅ JCN ${
            mode === "create" ? "created" : close ? "closed" : "updated"
          } successfully`
        );

        if (mode === "update") {
          fetch("http://localhost:5000/api/jcns?status=OPEN")
            .then((res) => res.json())
            .then(setJcns)
            .catch((err) => console.error("Error refreshing JCNs:", err));
        }

        resetForm();
      } else {
        alert("❌ Failed to save JCN");
      }
    } catch (err) {
      console.error("Error saving JCN:", err);
    }
  };

  const isLockedBeforeSelect = mode === "update" && !selectedJcn;
  const isLockedAfterSelect =
    mode === "update" && selectedJcn && selectedJcnData;

  return (
    <Paper
      sx={{
        p: 4,
        bgcolor: "#0a0f1f",
        border: "1px solid #00fff7",
        borderRadius: 3,
        color: "#fff",
        maxWidth: "800px",
        mx: "auto",
      }}
    >
      <Typography variant="h5" sx={{ mb: 3, color: "#00fff7" }}>
        Maintenance JCN
      </Typography>

      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel sx={{ color: "#00fff7" }}>Mode</InputLabel>
        <Select
          value={mode}
          onChange={(e) => resetForm() || setMode(e.target.value)}
          sx={{ color: "#fff" }}
        >
          <MenuItem value="create">Create New</MenuItem>
          <MenuItem value="update">Update Existing</MenuItem>
        </Select>
      </FormControl>

      {mode === "update" && (
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel sx={{ color: "#00fff7" }}>Select JCN</InputLabel>
          <Select
            value={selectedJcn}
            onChange={(e) => setSelectedJcn(e.target.value)}
            sx={{ color: "#fff" }}
          >
            <MenuItem value="">
              <em>-- Select JCN --</em>
            </MenuItem>
            {jcns.map((j) => (
              <MenuItem key={j.id} value={String(j.id)}>
                {j.jcn_no} - {j.aircraft_type} {j.aircraft_variant} (
                {j.maintenance_type}){" "}
                {j.maintenance_type === "unscheduled"
                  ? `: ${j.discrepancy}`
                  : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          saveJcn();
        }}
        display="flex"
        flexDirection="column"
        gap={3}
      >
        {/* JCN Number */}
        <TextField
          label="JCN Number"
          variant="outlined"
          value={jcnNo}
          onChange={(e) => setJcnNo(e.target.value)}
          sx={{
            input: { color: "#fff" },
            label: {
              color:
                isLockedBeforeSelect || isLockedAfterSelect
                  ? "#888"
                  : "#00fff7",
            },
          }}
          disabled={isLockedBeforeSelect || isLockedAfterSelect}
        />

        {/* Aircraft */}
        {mode === "update" && selectedJcnData ? (
          <TextField
            label="Aircraft"
            value={`${selectedJcnData.tail_number} (${selectedJcnData.aircraft_type} ${selectedJcnData.aircraft_variant})`}
            InputProps={{ readOnly: true }}
            sx={{ input: { color: "#888" }, label: { color: "#888" } }}
          />
        ) : (
          <FormControl fullWidth>
            <InputLabel
              sx={{ color: isLockedBeforeSelect ? "#888" : "#00fff7" }}
            >
              Aircraft
            </InputLabel>
            <Select
              value={aircraftId}
              onChange={(e) => setAircraftId(e.target.value)}
              disabled={isLockedBeforeSelect}
              sx={{ color: isLockedBeforeSelect ? "#888" : "#fff" }}
            >
              <MenuItem value="">
                <em>-- Select Aircraft --</em>
              </MenuItem>
              {aircraft.map((a) => (
                <MenuItem key={a.id} value={String(a.id)}>
                  {a.tail_number} ({a.type} {a.variant})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Maintenance Type */}
        {mode === "update" && selectedJcnData ? (
          <TextField
            label="Maintenance Type"
            value={selectedJcnData.maintenance_type}
            InputProps={{ readOnly: true }}
            sx={{ input: { color: "#888" }, label: { color: "#888" } }}
          />
        ) : (
          <FormControl fullWidth>
            <InputLabel
              sx={{ color: isLockedBeforeSelect ? "#888" : "#00fff7" }}
            >
              Maintenance Type
            </InputLabel>
            <Select
              value={maintenanceType}
              onChange={(e) => setMaintenanceType(e.target.value)}
              disabled={isLockedBeforeSelect}
              sx={{ color: isLockedBeforeSelect ? "#888" : "#fff" }}
            >
              <MenuItem value="">
                <em>-- Select Maintenance Type --</em>
              </MenuItem>
              <MenuItem value="scheduled">Scheduled</MenuItem>
              <MenuItem value="unscheduled">Unscheduled</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Inspection */}
        {maintenanceType === "scheduled" && (
          <FormControl fullWidth>
            {mode === "create" || !selectedJcnData ? (
              <>
                <InputLabel
                  sx={{ color: isLockedBeforeSelect ? "#888" : "#00fff7" }}
                >
                  Inspection
                </InputLabel>
                <Select
                  value={inspectionId}
                  onChange={(e) => setInspectionId(e.target.value)}
                  disabled={isLockedBeforeSelect}
                  sx={{ color: isLockedBeforeSelect ? "#888" : "#fff" }}
                >
                  <MenuItem value="">
                    <em>-- Select Inspection --</em>
                  </MenuItem>
                  {inspections.map((insp) => (
                    <MenuItem key={insp.id} value={String(insp.id)}>
                      {insp.name} ({insp.trigger_type}-{insp.interval_value})
                    </MenuItem>
                  ))}
                </Select>
              </>
            ) : (
              <TextField
                label="Inspection"
                value={
                  inspections.find(
                    (i) =>
                      String(i.id) === String(selectedJcnData.inspection_id)
                  )
                    ? `${
                        inspections.find(
                          (i) =>
                            String(i.id) ===
                            String(selectedJcnData.inspection_id)
                        ).name
                      } (${
                        inspections.find(
                          (i) =>
                            String(i.id) ===
                            String(selectedJcnData.inspection_id)
                        ).trigger_type
                      }-${
                        inspections.find(
                          (i) =>
                            String(i.id) ===
                            String(selectedJcnData.inspection_id)
                        ).interval_value
                      })`
                    : "N/A"
                }
                InputProps={{ readOnly: true }}
                sx={{ input: { color: "#888" }, label: { color: "#888" } }}
              />
            )}
          </FormControl>
        )}

        {/* Discrepancy */}
        <TextField
          label="Discrepancy"
          multiline
          rows={3}
          value={discrepancy}
          onChange={(e) => setDiscrepancy(e.target.value)}
          sx={{
            textarea: { color: "#fff" },
            label: { color: isLockedAfterSelect ? "#888" : "#00fff7" },
          }}
          disabled={isLockedAfterSelect}
        />

        {/* Corrective Action */}
        <TextField
          label="Corrective Action"
          multiline
          rows={3}
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          sx={{ textarea: { color: "#fff" }, label: { color: "#00fff7" } }}
        />

        <Button
          type="submit"
          variant="contained"
          sx={{ bgcolor: "#00fff7", color: "#000" }}
        >
          {mode === "create" ? "Submit JCN" : "Update JCN"}
        </Button>

        {mode === "update" && selectedJcn && (
          <Button
            type="button"
            variant="outlined"
            onClick={() => saveJcn(true)}
            sx={{ borderColor: "#00fff7", color: "#00fff7" }}
          >
            Close JCN
          </Button>
        )}
      </Box>
    </Paper>
  );
}
