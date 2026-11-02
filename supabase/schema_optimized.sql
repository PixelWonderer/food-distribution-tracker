-- Food Tracker Database Schema - Optimized Version
-- This file contains the cleaned up and optimized database schema

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
  quantity NUMERIC(12,4) NOT NULL CHECK (quantity >= 0),
  unit TEXT,
  storage_type TEXT CHECK (storage_type IN ('Pantry', 'Fridge', 'Both', NULL)),
  ran_out BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(week_date, item_name) -- Prevent duplicate items per week
);

-- Distribution destinations
CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- 'partner_1', 'coop_a', 'packOut', etc.
  name TEXT NOT NULL,
  timing TEXT,
  is_direct BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true, -- Allow soft delete of destinations
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Order allocations (from sheets)
CREATE TABLE allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  allocated_quantity NUMERIC(12,4) NOT NULL CHECK (allocated_quantity >= 0),
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
  UNIQUE(allocation_id), -- One storage tracking per allocation
  CHECK (
    (is_stored = false AND stored_by IS NULL AND stored_at IS NULL) OR
    (is_stored = true AND stored_by IS NOT NULL AND stored_at IS NOT NULL)
  ) -- Ensure consistency when stored
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
  UNIQUE(allocation_id), -- One distribution tracking per allocation
  CHECK (
    (is_distributed = false AND distributed_by IS NULL AND distributed_at IS NULL) OR
    (is_distributed = true AND distributed_by IS NOT NULL AND distributed_at IS NOT NULL)
  ) -- Ensure consistency when distributed
);

-- Custom items (not from Google Sheets)
CREATE TABLE custom_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  unit TEXT,
  is_packed BOOLEAN DEFAULT false,
  added_by TEXT NOT NULL, -- Require user identification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Supplies tracking
CREATE TABLE supplies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
  week_date DATE NOT NULL,
  supply_type TEXT NOT NULL CHECK (supply_type IN ('mealBoxes', 'forks', 'napkins', 'other')),
  is_packed BOOLEAN DEFAULT false,
  quantity NUMERIC(12,4) CHECK (quantity > 0),
  notes TEXT, -- For additional supply details
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(destination_id, week_date, supply_type)
);

-- Enhanced indexes for better query performance
CREATE INDEX idx_orders_week_date ON orders(week_date);
CREATE INDEX idx_orders_storage_type ON orders(storage_type) WHERE storage_type IS NOT NULL;
CREATE INDEX idx_orders_ran_out ON orders(ran_out) WHERE ran_out = true;

CREATE INDEX idx_destinations_active ON destinations(is_active) WHERE is_active = true;
CREATE INDEX idx_destinations_display_order ON destinations(display_order);

CREATE INDEX idx_allocations_order_id ON allocations(order_id);
CREATE INDEX idx_allocations_destination_id ON allocations(destination_id);
CREATE INDEX idx_allocations_quantity ON allocations(allocated_quantity) WHERE allocated_quantity > 0;

CREATE INDEX idx_storage_tracking_allocation_id ON storage_tracking(allocation_id);
CREATE INDEX idx_storage_tracking_stored ON storage_tracking(is_stored);
CREATE INDEX idx_storage_tracking_date ON storage_tracking(stored_at);

CREATE INDEX idx_distribution_tracking_allocation_id ON distribution_tracking(allocation_id);
CREATE INDEX idx_distribution_tracking_distributed ON distribution_tracking(is_distributed);
CREATE INDEX idx_distribution_tracking_date ON distribution_tracking(distributed_at);

CREATE INDEX idx_custom_items_week_date ON custom_items(week_date);
CREATE INDEX idx_custom_items_destination_id ON custom_items(destination_id);
CREATE INDEX idx_custom_items_packed ON custom_items(is_packed);

CREATE INDEX idx_supplies_week_date ON supplies(week_date);
CREATE INDEX idx_supplies_destination_id ON supplies(destination_id);
CREATE INDEX idx_supplies_packed ON supplies(is_packed);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers to all tables with updated_at
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

-- Insert default destinations (updated with current project needs)
INSERT INTO destinations (code, name, timing, is_direct, display_order) VALUES
  ('partner_1', 'Partner Group 1', 'Friday AM', true, 1),
  ('coop_a', 'Co-op A', 'Friday noon', false, 2),  
  ('partner_2', 'Partner Group 2', 'Friday PM', true, 3),
  ('coop_b', 'Co-op B', 'Saturday', false, 4),
  ('partner_6', 'Partner 6', 'Saturday', false, 5),
  ('partner_5', 'Partner Group 5', 'Saturday', false, 6),
  ('coop_c', 'Co-op C', 'Sunday', false, 7),
  ('partner_4', 'Partner Group 4', 'Sunday', false, 8);

-- Create view for easier data querying
CREATE OR REPLACE VIEW v_allocation_summary AS
SELECT 
  o.week_date,
  o.item_name,
  o.quantity as total_quantity,
  o.unit,
  o.storage_type,
  o.ran_out,
  d.code as destination_code,
  d.name as destination_name,
  d.timing,
  d.is_direct,
  a.allocated_quantity,
  COALESCE(st.is_stored, false) as is_stored,
  st.stored_by,
  st.stored_at,
  COALESCE(dt.is_distributed, false) as is_distributed,
  dt.distributed_by,
  dt.distributed_at,
  a.id as allocation_id
FROM orders o
JOIN allocations a ON o.id = a.order_id
JOIN destinations d ON a.destination_id = d.id
LEFT JOIN storage_tracking st ON a.id = st.allocation_id
LEFT JOIN distribution_tracking dt ON a.id = dt.allocation_id
WHERE d.is_active = true
ORDER BY o.week_date DESC, d.display_order, o.item_name;

-- Grant permissions on view
ALTER VIEW v_allocation_summary OWNER TO postgres;
