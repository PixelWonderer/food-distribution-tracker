-- Migration: Ensure custom_items table exists
-- This fixes the "relation 'custom_items' does not exist" error

-- Create custom_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS custom_items (
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_custom_items_destination_week
  ON custom_items(destination_id, week_date);

CREATE INDEX IF NOT EXISTS idx_custom_items_week_date
  ON custom_items(week_date);

-- Add comment for documentation
COMMENT ON TABLE custom_items IS 'Custom items added by volunteers that are not from the Google Sheets import. These persist across imports.';
