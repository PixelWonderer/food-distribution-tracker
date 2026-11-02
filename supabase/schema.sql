-- Food Tracker Database Schema
-- Phase 1: Core Tables Setup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS supplies CASCADE;
DROP TABLE IF EXISTS custom_items CASCADE;
DROP TABLE IF EXISTS distribution_tracking CASCADE;
DROP TABLE IF EXISTS storage_tracking CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS destinations CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Core order data (synced from Google Sheets)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL,
  unit TEXT,
  storage_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(week_date, item_name) -- Prevent duplicate items per week
);

-- Distribution destinations
CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- 'partner_1', 'coop_a', 'packOut', etc.
  name TEXT NOT NULL,
  short_name TEXT,
  timing TEXT,
  is_direct BOOLEAN DEFAULT false,
  sheet_column_index INTEGER DEFAULT -1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Order allocations (from sheets)
CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  allocated_quantity NUMERIC(12,4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(order_id, destination_id) -- One allocation per order-destination pair
);

-- Storage tracking
CREATE TABLE storage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  is_stored BOOLEAN DEFAULT false,
  stored_by TEXT,
  stored_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(allocation_id) -- One storage tracking per allocation
);

-- Distribution tracking
CREATE TABLE distribution_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_id UUID NOT NULL REFERENCES allocations(id) ON DELETE CASCADE,
  is_distributed BOOLEAN DEFAULT false,
  distributed_by TEXT,
  distributed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(allocation_id) -- One distribution tracking per allocation
);

-- Custom items (not from Google Sheets)
CREATE TABLE custom_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL,
  unit TEXT,
  is_packed BOOLEAN DEFAULT false,
  added_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Supplies tracking
CREATE TABLE supplies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  supply_type TEXT NOT NULL, -- 'mealBoxes', 'forks', 'napkins', etc.
  is_packed BOOLEAN DEFAULT false,
  quantity NUMERIC(12,4),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(destination_id, week_date, supply_type)
);

-- Create indexes for better query performance
CREATE INDEX idx_orders_week_date ON orders(week_date);
CREATE INDEX idx_allocations_order_id ON allocations(order_id);
CREATE INDEX idx_allocations_destination_id ON allocations(destination_id);
CREATE INDEX idx_storage_tracking_allocation_id ON storage_tracking(allocation_id);
CREATE INDEX idx_distribution_tracking_allocation_id ON distribution_tracking(allocation_id);
CREATE INDEX idx_custom_items_week_date ON custom_items(week_date);
CREATE INDEX idx_custom_items_destination_id ON custom_items(destination_id);
CREATE INDEX idx_supplies_week_date ON supplies(week_date);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_destinations_updated_at BEFORE UPDATE ON destinations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at BEFORE UPDATE ON allocations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_storage_tracking_updated_at BEFORE UPDATE ON storage_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distribution_tracking_updated_at BEFORE UPDATE ON distribution_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_items_updated_at BEFORE UPDATE ON custom_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplies_updated_at BEFORE UPDATE ON supplies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default destinations
INSERT INTO destinations (code, name, short_name, timing, is_direct, sheet_column_index, display_order) VALUES
  ('partner_1', 'Partner Group 1', 'Partner Group 1', 'Thursday', false, 5, 1),
  ('coop_a', 'Co-op A', 'Co-op A', 'Friday', false, 7, 2),
  ('packOut', 'Pack Out', 'Pack Out', 'Direct', true, -1, 3),
  ('directGive', 'Direct Give', 'Direct Give', 'Direct', true, -1, 4),
  ('delivered', 'Delivered', 'Delivered', 'Direct', true, -1, 5),
  ('cac', 'CAC', 'CAC', 'Saturday', false, -1, 6),
  ('partner_8', 'Partner Group 8', 'Partner Group 8', 'Sunday', false, -1, 7),
  ('hp', 'HP', 'HP', 'Monday', false, -1, 8);
