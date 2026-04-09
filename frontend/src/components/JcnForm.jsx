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
import { ataCodes, ataName } from "../utils/ataCodes";

export default function JcnForm() {
  const [mode, setMode] = useState("create");
  const [jcnNo, setJcnNo] = useState("");
  const [aircraftId, setAircraftId] = useState("");
  const [workUnitCode, setWorkUnitCode] = useState("");

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
  const [scheduledInspections, setScheduledInspections] = useState([]);
  const [scheduledJcns, setScheduledJcns] = useState([]);

  // const ataCodes = [
  //   { code: "21", name: "Air Conditioning" },
  //   { code: "24", name: "Electrical Power" },
  //   { code: "27", name: "Flight Controls" },
  //   { code: "28", name: "Fuel" },
  //   { code: "32", name: "Landing Gear" },
  //   { code: "34", name: "Navigation" },
  //   { code: "36", name: "Pneumatics" },
  //   { code: "49", name: "APU" },
  //   { code: "71", name: "Powerplant" },
  //   { code: "78", name: "Exhaust" },
  //   { code: "80", name: "Starting" },
  // ];

  // Load aircraft
  useEffect(() => {
    fetch("http://localhost:5000/api/aircraft/all")
      .then((res) => res.json())
      .then(setAircraft)
      .catch((err) => console.error("Error loading aircraft:", err));
  }, []);

  // Load inspections if scheduled
  useEffect(() => {
    if (maintenanceType === "scheduled" && aircraftId) {
      fetch(`http://localhost:5000/api/inspections?aircraft_id=${aircraftId}`)
        .then((res) => res.json())
        .then(setInspections)
        .catch((err) => console.error("Error loading inspections:", err));
    } else {
      setInspectionId("");
      setInspections([]);
    }
  }, [maintenanceType, aircraftId]);

  // Load pending scheduled inspections (for Create New JCN dropdown)
  useEffect(() => {
    if (mode === "create") {
      fetch("http://localhost:5000/api/inspections/scheduled/pending")
        .then((res) => res.json())
        .then(setScheduledJcns)
        .catch((err) =>
          console.error("Error loading pending scheduled JCNs:", err)
        );
    }
  }, [mode]);

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
        setWorkUnitCode(jcn.work_unit_code || "");

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

  // Load scheduled inspections (for dropdown)
  useEffect(() => {
    fetch("http://localhost:5000/api/inspections/scheduled")
      .then((res) => res.json())
      .then(setScheduledInspections)
      .catch((err) =>
        console.error("Error loading scheduled inspections:", err)
      );
  }, []);

  const resetForm = () => {
    setMode("create");
    setSelectedJcn("");
    setSelectedJcnData(null);
    setJcnNo("");
    setAircraftId("");
    setWorkUnitCode("");

    setMaintenanceType("");
    setDiscrepancy("");
    setCorrectiveAction("");
    setInspectionId("");
    setShowCustomInspection(false);
    setCustomInspection({ name: "", trigger_type: "", interval_value: "" });
  };

  const saveJcn = async (close = false) => {
    try {
      // Build payload
      let payload = close
        ? { corrective_action: correctiveAction || null, close: true }
        : {
            jcn_no: jcnNo,
            aircraft_id: aircraftId ? parseInt(aircraftId, 10) : null,
            work_unit_code: workUnitCode || null,
            maintenance_type: maintenanceType,
            discrepancy: discrepancy || null,
            corrective_action: correctiveAction || null,
            inspection_id:
              maintenanceType === "scheduled" ? inspectionId : null,
            close: false,
          };

      // 🔹 Add custom inspection if any
      if (showCustomInspection && customInspection.name) {
        payload.custom_inspection_name = customInspection.name;
        payload.custom_trigger_type = customInspection.trigger_type;
        payload.custom_interval_value = parseInt(
          customInspection.interval_value,
          10
        );
      }

      // 🔹 API endpoint + method
      const url =
        mode === "create"
          ? "http://localhost:5000/api/jcns"
          : `http://localhost:5000/api/jcns/${selectedJcn}${
              close ? "/close" : ""
            }`;

      const method = mode === "create" || close ? "POST" : "PUT";
      // 🔹 Request
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ✅ Only parse JSON if response has content-type
      let data = null;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      }

      if (res.ok) {
        alert(
          `✅ JCN ${
            mode === "create" ? "created" : close ? "closed" : "updated"
          } successfully`
        );

        // 🔹 Refresh JCNs if updating
        if (mode === "update") {
          fetch("http://localhost:5000/api/jcns?status=OPEN")
            .then((res) => res.json())
            .then(setJcns)
            .catch((err) => console.error("Error refreshing JCNs:", err));
        }

        // 🔹 Always reset form after success
        resetForm();
      } else {
        alert("❌ Failed to save JCN: " + (data?.error || res.statusText));
      }
    } catch (err) {
      console.error("❌ Network/server error while saving JCN:", err);
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
            onChange={(e) => {
              const val = e.target.value;
              setSelectedJcn(val);

              // If a scheduled JCN was chosen, preload its info
              const scheduled = scheduledJcns.find((j) => j.jcn_no === val);
              if (scheduled) {
                setMode("create");
                setJcnNo(scheduled.jcn_no);
                setAircraftId(String(scheduled.aircraft_id));
                setInspectionId(String(scheduled.inspection_id));
                setMaintenanceType("scheduled");
              }
            }}
            sx={{ color: "#fff" }}
          >
            <MenuItem value="">
              <em>-- Select JCN --</em>
            </MenuItem>

            <optgroup label="Scheduled JCNs">
              {scheduledJcns.map((j) => (
                <MenuItem key={j.jcn_no} value={j.jcn_no}>
                  {j.jcn_no} — {j.aircraft_name || `AC#${j.aircraft_id}`}{" "}
                  (Scheduled)
                </MenuItem>
              ))}
            </optgroup>

            <optgroup label="Open JCNs">
              {jcns.map((j) => (
                <MenuItem key={j.id} value={String(j.id)}>
                  {j.jcn_no} - {j.aircraft_type} {j.aircraft_variant} (
                  {j.maintenance_type})
                </MenuItem>
              ))}
            </optgroup>
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
        {/* JCN Number */}
        {mode === "create" ? (
          <FormControl fullWidth>
            <InputLabel sx={{ color: "#00fff7" }}>
              Select Scheduled Inspection (optional)
            </InputLabel>
            <Select
              value={inspectionId}
              onChange={(e) => {
                const selected = scheduledJcns.find(
                  (s) => String(s.scheduled_id) === e.target.value
                );
                if (selected) {
                  setInspectionId(selected.inspection_id);
                  setAircraftId(String(selected.aircraft_id));
                  setMaintenanceType("scheduled");
                  // Generate formatted JCN (replace AUTO)
                  setJcnNo(
                    `SCH-${
                      selected.tail_number
                    }-${selected.inspection_name.replace(
                      /\s+/g,
                      "-"
                    )}-${Date.now()}`
                  );
                } else {
                  setInspectionId("");
                  setAircraftId("");
                  setMaintenanceType("");
                  setJcnNo("");
                }
              }}
              sx={{ color: "#fff" }}
            >
              <MenuItem value="">
                <em>— None —</em>
              </MenuItem>
              {scheduledJcns.length > 0 ? (
                scheduledJcns.map((s) => (
                  <MenuItem key={s.scheduled_id} value={String(s.scheduled_id)}>
                    {s.tail_number} | {s.inspection_name} — {s.scheduled_date}
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled>No pending scheduled inspections</MenuItem>
              )}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label="JCN Number"
            variant="outlined"
            value={jcnNo}
            onChange={(e) => setJcnNo(e.target.value)}
            sx={{ input: { color: "#fff" }, label: { color: "#00fff7" } }}
            disabled={isLockedBeforeSelect || isLockedAfterSelect}
          />
        )}

        {/* Aircraft */}
        {mode === "update" && selectedJcnData ? (
          <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
            <TextField
              label="Aircraft"
              value={`${selectedJcnData.tail_number} (${selectedJcnData.aircraft_type} ${selectedJcnData.aircraft_variant})`}
              InputProps={{ readOnly: true }}
              sx={{
                flex: 2,
                input: { color: "#888" },
                label: { color: "#888" },
              }}
            />
            <TextField
              label="Work Unit Code (ATA)"
              value={
                selectedJcnData.work_unit_code
                  ? `${selectedJcnData.work_unit_code} – ${ataName(
                      selectedJcnData.work_unit_code
                    )}`
                  : ""
              }
              InputProps={{ readOnly: true }}
              sx={{
                flex: 1,
                input: { color: "#888" },
                label: { color: "#888" },
              }}
            />
          </Box>
        ) : (
          <Box display="flex" gap={2}>
            <FormControl sx={{ flex: 2 }}>
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

            {/* WUC / ATA Code */}
            <FormControl sx={{ flex: 1 }}>
              <InputLabel
                sx={{ color: isLockedBeforeSelect ? "#888" : "#00fff7" }}
              >
                Work Unit Code (ATA)
              </InputLabel>
              <Select
                value={workUnitCode}
                onChange={(e) => setWorkUnitCode(e.target.value)}
                disabled={isLockedBeforeSelect}
                sx={{ color: isLockedBeforeSelect ? "#888" : "#fff" }}
              >
                <MenuItem value="">
                  <em>-- Select ATA Code --</em>
                </MenuItem>
                {ataCodes.map((ata) => (
                  <MenuItem key={ata.code} value={ata.code}>
                    {ata.code} – {ata.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
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
        {/* Linked Scheduled Inspection (optional) */}
        {maintenanceType === "scheduled" && (
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={{ color: "#00fff7" }}>
              Linked Scheduled Inspection (optional)
            </InputLabel>
            <Select
              value={inspectionId}
              onChange={(e) => setInspectionId(e.target.value)}
              sx={{ color: "#fff" }}
            >
              <MenuItem value="">
                <em>— None —</em>
              </MenuItem>
              {scheduledInspections.map((insp) => (
                <MenuItem key={insp.id} value={insp.id}>
                  {insp.name} — {insp.aircraft_name || `AC#${insp.aircraft_id}`}
                </MenuItem>
              ))}
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
            <FormControl sx={{ flex: 1 }}>
              <InputLabel sx={{ color: "#00fff7" }}>Trigger Type</InputLabel>
              <Select
                value={customInspection.trigger_type}
                onChange={(e) =>
                  setCustomInspection((prev) => ({
                    ...prev,
                    trigger_type: e.target.value,
                  }))
                }
                sx={{ color: "#fff" }}
              >
                <MenuItem value="FH">FH</MenuItem>
                <MenuItem value="FC">FC</MenuItem>
                <MenuItem value="FL">FL</MenuItem>
                <MenuItem value="Calendar">Calendar</MenuItem>
              </Select>
            </FormControl>
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
