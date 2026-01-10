-- MilesConnect Fleet Tracking Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'working')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'in_use')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  current_route JSONB,
  route_index INTEGER DEFAULT 0,
  eta TIMESTAMPTZ,
  tracking_mode TEXT DEFAULT 'simulated' CHECK (tracking_mode IN ('simulated', 'live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shipments table
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_number TEXT NOT NULL UNIQUE,
  start_location TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  dest_lat DOUBLE PRECISION,
  dest_lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  revenue NUMERIC(10, 2),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- Indexes for better query performance
CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_driver_id ON shipments(driver_id);
CREATE INDEX idx_shipments_vehicle_id ON shipments(vehicle_id);
CREATE INDEX idx_shipments_created_at ON shipments(created_at DESC);

-- Row Level Security (RLS) - Disabled for MVP (no auth)
-- Enable these when you add authentication
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;


-- Enable Realtime for vehicles table (for live tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;

-- Driver Alerts table (for delay and emergency reporting)
CREATE TABLE driver_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('delay', 'emergency')),
  issue TEXT NOT NULL,
  custom_message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_alerts_status ON driver_alerts(status);
CREATE INDEX idx_driver_alerts_created_at ON driver_alerts(created_at DESC);

ALTER TABLE driver_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for driver_alerts" ON driver_alerts FOR ALL USING (true) WITH CHECK (true);

-- Allow all operations for anonymous users (MVP without auth)
CREATE POLICY "Allow all for drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for shipments" ON shipments FOR ALL USING (true) WITH CHECK (true);

-- Sample data (optional - remove in production)
INSERT INTO drivers (name, email, phone, status) VALUES
  ('John Smith', 'john.smith@email.com', '+1-555-0101', 'idle'),
  ('Sarah Johnson', 'sarah.j@email.com', '+1-555-0102', 'idle'),
  ('Mike Wilson', 'mike.w@email.com', '+1-555-0103', 'idle');

INSERT INTO vehicles (type, license_plate, status) VALUES
  ('Truck', 'MC-1001', 'idle'),
  ('Van', 'MC-2001', 'idle'),
  ('Truck', 'MC-1002', 'idle'),
  ('Trailer', 'MC-3001', 'idle');
