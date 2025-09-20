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
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

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

  const [showCustomInspection, setShowCustomInspection] = useState(false);
  const [customInspection, setCustomInspection] = useState({
    name: "",
    trigger_type: "",
    interval_value: "",
  });

  // Load aircraft
  useEffect(() => {
    fetch("http://localhost:5000/api/aircraft")
      .then((res) => res.json())
      .then(setAircraft)
      .catch((err) => console.error("Error loading aircraft:", err));
  }, []);

  // Load inspections if scheduled
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

  // Load open JCNS if updating
  useEffect(() => {
    if (mode === "update") {
      fetch("http://localhost:5000/api/jcns?status=OPEN")
        .then((res) => res.json())
        .then(setJcns)
        .catch((err) => console.error("Error loading JCNs:", err));
    }
  }, [mode]);

  // Load selected JCN data
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
    setShowCustomInspection(false);
    setCustomInspection({ name: "", trigger_type: "", interval_value: "" });
  };

  const saveJcn = async (close = false) => {
    try {
      // Prepare payload
      const payload = {
        jcn_no: jcnNo,
        aircraft_id: aircraftId ? parseInt(aircraftId, 10) : null,
        maintenance_type: maintenanceType,
        discrepancy: discrepancy || null,
        corrective_action: correctiveAction || null,
        inspection_id: maintenanceType === "scheduled" ? inspectionId : null,
        close,
      };

      // Include custom inspection if provided
      if (showCustomInspection && customInspection.name) {
        payload.custom_inspection_name = customInspection.name;
        payload.custom_trigger_type = customInspection.trigger_type;
        payload.custom_interval_value = parseInt(
          customInspection.interval_value,
          10
        );
      }

      // Determine endpoint and method
      const url =
        mode === "create"
          ? "http://localhost:5000/api/jcns"
          : `http://localhost:5000/api/jcns/${selectedJcn}${
              close ? "/close" : ""
            }`;

      const method = mode === "create" || close ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `✅ JCN ${
            mode === "create" ? "created" : close ? "closed" : "updated"
          } successfully`
        );

        // Refresh open JCNS if in update mode
        if (mode === "update") {
          fetch("http://localhost:5000/api/jcns?status=OPEN")
            .then((res) => res.json())
            .then(setJcns)
            .catch((err) => console.error("Error refreshing JCNs:", err));
        }

        resetForm();
      } else {
        const errData = await res.json();
        alert("❌ Failed to save JCN: " + (errData.error || res.statusText));
      }
    } catch (err) {
      console.error("Error saving JCN:", err);
      alert("❌ Failed to save JCN due to network or server error");
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

      {/* Mode selection */}
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

      {/* Select JCN if update mode */}
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

        {/* Inspections (only for scheduled) */}
        {maintenanceType === "scheduled" && (
          <Box display="flex" alignItems="center" gap={1}>
            <FormControl fullWidth>
              <InputLabel
                sx={{
                  color:
                    showCustomInspection ||
                    (mode === "update" && selectedJcnData)
                      ? "#888" // grayed out
                      : "#00fff7",
                }}
              >
                Inspection
              </InputLabel>
              <Select
                value={inspectionId}
                onChange={(e) => setInspectionId(e.target.value)}
                disabled={
                  showCustomInspection || (mode === "update" && selectedJcnData)
                }
                sx={{
                  color:
                    showCustomInspection ||
                    (mode === "update" && selectedJcnData)
                      ? "#888"
                      : "#fff",
                }}
              >
                <MenuItem value="">
                  <em>-- Select Inspection --</em>
                </MenuItem>
                {inspections.map((i) => (
                  <MenuItem key={i.id} value={String(i.id)}>
                    {i.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Plus button for custom inspection */}
            <IconButton
              color="primary"
              onClick={() => setShowCustomInspection((prev) => !prev)}
              disabled={mode === "update" && selectedJcnData}
            >
              <AddIcon
                sx={{
                  color:
                    showCustomInspection ||
                    (mode === "update" && selectedJcnData)
                      ? "#888"
                      : "#00fff7",
                }}
              />
            </IconButton>
          </Box>
        )}

        {/* Custom inspection fields */}
        {showCustomInspection && (
          <Box display="flex" gap={2} flexWrap="wrap">
            <TextField
              label="Inspection Name"
              variant="outlined"
              value={customInspection.name}
              onChange={(e) =>
                setCustomInspection((prev) => ({
                  ...prev,
                  name: e.target.value,
                }))
              }
              sx={{
                input: { color: "#fff" },
                label: { color: "#00fff7" },
                flex: 1,
              }}
            />
            <TextField
              label="Interval Value"
              variant="outlined"
              type="number"
              value={customInspection.interval_value}
              onChange={(e) =>
                setCustomInspection((prev) => ({
                  ...prev,
                  interval_value: e.target.value,
                }))
              }
              sx={{
                input: { color: "#fff" },
                label: { color: "#00fff7" },
                flex: 1,
              }}
            />
            <TextField
              label="Trigger Type"
              variant="outlined"
              value={customInspection.trigger_type}
              onChange={(e) =>
                setCustomInspection((prev) => ({
                  ...prev,
                  trigger_type: e.target.value,
                }))
              }
              sx={{
                input: { color: "#fff" },
                label: { color: "#00fff7" },
                flex: 1,
              }}
            />
          </Box>
        )}

        {/* Discrepancy */}
        <TextField
          label="Discrepancy"
          variant="outlined"
          value={discrepancy}
          onChange={(e) => setDiscrepancy(e.target.value)}
          multiline
          minRows={2}
          sx={{ input: { color: "#fff" }, label: { color: "#00fff7" } }}
        />

        {/* Corrective Action */}
        <TextField
          label="Corrective Action"
          variant="outlined"
          value={correctiveAction}
          onChange={(e) => setCorrectiveAction(e.target.value)}
          multiline
          minRows={2}
          sx={{ input: { color: "#fff" }, label: { color: "#00fff7" } }}
        />

        {/* Submit */}
        <Box display="flex" gap={2} mt={2}>
          <Button variant="contained" color="primary" onClick={() => saveJcn()}>
            Create / Update JCN
          </Button>
          {mode === "update" && selectedJcn && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => saveJcn(true)}
            >
              Close JCN
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
