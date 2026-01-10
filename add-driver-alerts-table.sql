-- Migration: Add Driver Alerts Table
-- Run this in your Supabase SQL Editor to add the driver alerts feature
-- This is a migration script - run this on existing databases

-- Driver Alerts table (for delay and emergency reporting)
CREATE TABLE IF NOT EXISTS driver_alerts (
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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_driver_alerts_status ON driver_alerts(status);
CREATE INDEX IF NOT EXISTS idx_driver_alerts_created_at ON driver_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_alerts_driver_id ON driver_alerts(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_alerts_alert_type ON driver_alerts(alert_type);

-- Enable Row Level Security
ALTER TABLE driver_alerts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (MVP without auth)
-- Drop policy first if it exists to avoid errors on re-run
DROP POLICY IF EXISTS "Allow all for driver_alerts" ON driver_alerts;
CREATE POLICY "Allow all for driver_alerts" ON driver_alerts FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for driver_alerts table (for live notifications)
-- Note: This may fail if already added, which is fine
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE driver_alerts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Already added, ignore
END $$;
