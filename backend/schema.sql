-- =========================
-- Clean Schema: Aircraft Maintenance System
-- =========================

-- Drop in correct dependency order
DROP TABLE IF EXISTS inspection_history CASCADE;
DROP TABLE IF EXISTS inspections CASCADE;
DROP TABLE IF EXISTS flying_data CASCADE;
DROP TABLE IF EXISTS rotable_movements CASCADE;
DROP TABLE IF EXISTS maintenance_demands CASCADE;
DROP TABLE IF EXISTS maintenance_jcn CASCADE;
DROP TABLE IF EXISTS consumables CASCADE;
DROP TABLE IF EXISTS rotable_items CASCADE;
DROP TABLE IF EXISTS components CASCADE;
DROP TABLE IF EXISTS aircraft CASCADE;

-- =========================
-- Aircraft Master Table
-- =========================
CREATE TABLE aircraft (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  variant VARCHAR(50),
  tail_number VARCHAR(20) UNIQUE NOT NULL,
  current_fh INTEGER DEFAULT 0,
  current_fc INTEGER DEFAULT 0,
  current_fl INTEGER DEFAULT 0,
  squadron VARCHAR(20),
  operational_status VARCHAR(20) DEFAULT 'serviceable'
    CHECK (operational_status IN ('serviceable','unserviceable')),
  unserviceable_reason VARCHAR(20)
    CHECK (unserviceable_reason IN ('scheduled','unscheduled','MICAP','allotted_out')),
  details TEXT
);

-- =========================
-- Component Master
-- =========================
CREATE TABLE components (
  id SERIAL PRIMARY KEY,
  part_number VARCHAR(50) NOT NULL,
  nomenclature VARCHAR(100) NOT NULL,
  category VARCHAR(20) CHECK (category IN ('rotable', 'consumable'))
);

-- =========================
-- Individual Rotable Items
-- =========================
CREATE TABLE rotable_items (
  id SERIAL PRIMARY KEY,
  component_id INT REFERENCES components(id),
  serial_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) CHECK (status IN ('serviceable', 'unserviceable', 'under_repair')) DEFAULT 'serviceable',
  location VARCHAR(50)
);

-- =========================
-- Consumable Stock Tracking
-- =========================
CREATE TABLE consumables (
  id SERIAL PRIMARY KEY,
  component_id INT REFERENCES components(id),
  quantity_on_hand INT DEFAULT 0,
  unit VARCHAR(20)
);

-- =========================
-- Maintenance Inspections
-- =========================
CREATE TABLE inspections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('FH', 'FC', 'FL', 'CALENDAR')),
  interval_value INTEGER NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- Maintenance Job Control Number (JCN)
-- =========================
CREATE TABLE maintenance_jcn (
  id SERIAL PRIMARY KEY,
  jcn_no VARCHAR(50) UNIQUE NOT NULL,
  aircraft_id INT REFERENCES aircraft(id),
  inspection_id INT REFERENCES inspections(id),
  maintenance_type VARCHAR(20) CHECK (maintenance_type IN ('scheduled', 'unscheduled')),
  work_unit_code VARCHAR(50),
  discrepancy TEXT,
  corrective_action TEXT,
  status VARCHAR(20) DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP
);

-- =========================
-- Maintenance Demands
-- =========================
CREATE TABLE maintenance_demands (
  id SERIAL PRIMARY KEY,
  jcn_id INT REFERENCES maintenance_jcn(id) ON DELETE CASCADE,
  component_id INT REFERENCES components(id),
  quantity INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING / ISSUED / NOT AVAILABLE
  created_at TIMESTAMP DEFAULT NOW()
);

-- =========================
-- Rotable Lifecycle Movements
-- =========================
CREATE TABLE rotable_movements (
  id SERIAL PRIMARY KEY,
  jcn_id INT REFERENCES maintenance_jcn(id),
  rotable_id INT REFERENCES rotable_items(id),
  action VARCHAR(50) CHECK (action IN ('removed', 'installed', 'sent_to_repair', 'repaired', 'issued_to_flightline')),
  action_time TIMESTAMP DEFAULT NOW()
);

-- =========================
-- Flying Data
-- =========================
CREATE TABLE flying_data (
  id SERIAL PRIMARY KEY,
  unit VARCHAR(50),
  sorties INT,
  flight_hours INT,
  ground_aborts INT,
  air_aborts INT,
  period DATE
);

-- =========================
-- Inspection History
-- =========================
CREATE TABLE inspection_history (
  id SERIAL PRIMARY KEY,
  inspection_id INT REFERENCES inspections(id) ON DELETE CASCADE,
  aircraft_id INT REFERENCES aircraft(id) ON DELETE CASCADE,
  performed_on TIMESTAMP DEFAULT NOW(),
  fh_at_inspection INTEGER,
  fc_at_inspection INTEGER,
  fl_at_inspection INTEGER,
  remarks TEXT
);

-- =========================
-- Seed Data
-- =========================

-- Components
INSERT INTO components (part_number, nomenclature, category) VALUES
('OXY-001', 'Oxygen Regulator', 'rotable'),
('COM-002', 'Radio Transceiver', 'rotable'),
('LND-003', 'Landing Gear Actuator', 'rotable'),
('OR-100', 'O-Ring', 'consumable'),
('WSH-200', 'Washer', 'consumable');

-- Rotable Items
INSERT INTO rotable_items (component_id, serial_number, status, location) VALUES
(1, 'OXR-7788', 'serviceable', 'flightline'),
(2, 'RTX-4455', 'serviceable', 'flightline'),
(3, 'LGA-9922', 'under_repair', 'repairshop');

-- Consumables Stock
INSERT INTO consumables (component_id, quantity_on_hand, unit) VALUES
(4, 500, 'pcs'),
(5, 1200, 'pcs');

-- Sample Maintenance JCN
INSERT INTO maintenance_jcn (jcn_no, aircraft_id, maintenance_type, work_unit_code, discrepancy, corrective_action)
VALUES
('JCN-1001', 1, 'unscheduled', 'OXY', 'Low oxygen flow reported by pilot', 'Replaced oxygen regulator');

-- Link Rotable to JCN
INSERT INTO rotable_movements (jcn_id, rotable_id, action) VALUES
(1, 1, 'removed'),
(1, 1, 'sent_to_repair');

-- Flying Data
INSERT INTO flying_data (unit, sorties, flight_hours, ground_aborts, air_aborts, period) VALUES
('Squadron-9', 120, 350, 2, 1, '2025-09-01'),
('Squadron-11', 90, 280, 1, 0, '2025-09-01');

-- =========================
-- Reset Inspections + Seed
-- =========================
TRUNCATE inspections RESTART IDENTITY CASCADE;

INSERT INTO inspections (name, trigger_type, interval_value, is_custom) VALUES
-- Calendar-based
('3 Month Inspection', 'CALENDAR', 90, FALSE),
('4 Month Inspection', 'CALENDAR', 120, FALSE),
('6 Month Inspection', 'CALENDAR', 180, FALSE),
('12 Month Inspection', 'CALENDAR', 365, FALSE),

-- Flight Hours
('62 FH Inspection', 'FH', 62, FALSE),
('100 FH Inspection', 'FH', 100, FALSE),
('400 FH Inspection', 'FH', 400, FALSE),
('800 FH Inspection', 'FH', 800, FALSE),
('1600 FH Inspection', 'FH', 1600, FALSE),
('2400 FH Inspection', 'FH', 2400, FALSE),

-- Flight Landings
('800 FL Inspection', 'FL', 800, FALSE),
('1600 FL Inspection', 'FL', 1600, FALSE),
('2400 FL Inspection', 'FL', 2400, FALSE),
('3200 FL Inspection', 'FL', 3200, FALSE);

-- =========================
-- Seed Aircraft by Squadron
-- =========================
TRUNCATE aircraft RESTART IDENTITY CASCADE;

-- Sqn 39: 10x F-16 Block 52
INSERT INTO aircraft (type, variant, tail_number, current_fh, current_fc, current_fl, squadron, operational_status, unserviceable_reason, details) VALUES
('F-16', 'Block 52A', 'SQ39-F16-01', 1450, 930, 900, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52A', 'SQ39-F16-02', 1302, 820, 790, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52A', 'SQ39-F16-03', 1110, 700, 675, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52A', 'SQ39-F16-04', 980, 640, 610, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52A', 'SQ39-F16-05', 760, 495, 480, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52B', 'SQ39-F16-06', 1560, 1020, 990, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52B', 'SQ39-F16-07', 1125, 720, 700, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52B', 'SQ39-F16-08', 900, 570, 560, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52B', 'SQ39-F16-09', 670, 420, 410, 'Sqn 39', 'serviceable', NULL, NULL),
('F-16', 'Block 52B', 'SQ39-F16-10', 300, 180, 175, 'Sqn 39', 'serviceable', NULL, NULL);

-- Sqn 49: 20x JF-17 Block II
INSERT INTO aircraft (type, variant, tail_number, current_fh, current_fc, current_fl, squadron, operational_status, unserviceable_reason, details) VALUES
('JF-17', 'Block II-A', 'SQ49-JF17-01', 520, 350, 340, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-A', 'SQ49-JF17-02', 610, 410, 400, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-A', 'SQ49-JF17-03', 450, 300, 290, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-A', 'SQ49-JF17-04', 380, 260, 255, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-A', 'SQ49-JF17-05', 210, 120, 110, 'Sqn 49', 'serviceable', NULL, NULL),
-- Block II-B
('JF-17', 'Block II-B', 'SQ49-JF17-06', 720, 480, 470, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-07', 680, 450, 435, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-08', 630, 410, 400, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-09', 590, 380, 375, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-10', 560, 360, 350, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-11', 510, 320, 310, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-12', 470, 290, 285, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-13', 420, 260, 250, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-14', 380, 230, 225, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-15', 340, 200, 195, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-16', 300, 175, 170, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-17', 260, 150, 145, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-18', 220, 125, 120, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-19', 180, 100, 95, 'Sqn 49', 'serviceable', NULL, NULL),
('JF-17', 'Block II-B', 'SQ49-JF17-20', 140, 80, 75, 'Sqn 49', 'serviceable', NULL, NULL);

-- Sqn 51: 5x DA-20 EW
INSERT INTO aircraft (type, variant, tail_number, current_fh, current_fc, current_fl, squadron, operational_status, unserviceable_reason, details) VALUES
('DA-20', 'EW', 'SQ51-DA20-01', 310, 200, 195, 'Sqn 51', 'serviceable', NULL, NULL),
('DA-20', 'EW', 'SQ51-DA20-02', 280, 180, 175, 'Sqn 51', 'serviceable', NULL, NULL),
('DA-20', 'EW', 'SQ51-DA20-03', 245, 150, 145, 'Sqn 51', 'serviceable', NULL, NULL),
('DA-20', 'EW', 'SQ51-DA20-04', 210, 125, 120, 'Sqn 51', 'serviceable', NULL, NULL),
('DA-20', 'EW', 'SQ51-DA20-05', 60, 30, 28, 'Sqn 51', 'serviceable', NULL, NULL);
