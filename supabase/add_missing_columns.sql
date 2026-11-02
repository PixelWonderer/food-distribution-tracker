-- Add missing columns to fix the app loading issue

-- Add short_name column to destinations table
ALTER TABLE destinations
ADD COLUMN IF NOT EXISTS short_name TEXT;

-- Add sheet column index for spreadsheet alignment
ALTER TABLE destinations
ADD COLUMN IF NOT EXISTS sheet_column_index INTEGER DEFAULT -1;

-- Update existing destinations with short names based on their names
UPDATE destinations SET short_name = 'Partner Group 1' WHERE code = 'partner_1' AND short_name IS NULL;
UPDATE destinations SET short_name = 'Co-op A' WHERE code = 'coop_a' AND short_name IS NULL;
UPDATE destinations SET short_name = 'Pack Out' WHERE code = 'packOut' AND short_name IS NULL;
UPDATE destinations SET short_name = 'Direct' WHERE code = 'directGive' AND short_name IS NULL;
UPDATE destinations SET short_name = 'Delivered' WHERE code = 'delivered' AND short_name IS NULL;
UPDATE destinations SET short_name = 'CAC' WHERE code = 'cac' AND short_name IS NULL;
UPDATE destinations SET short_name = 'Partner Group 8' WHERE code = 'partner_8' AND short_name IS NULL;
UPDATE destinations SET short_name = 'HP' WHERE code = 'hp' AND short_name IS NULL;

-- Add any other missing columns that might be expected
-- Check if orders table needs ran_out column
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS ran_out BOOLEAN DEFAULT false;

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Update sheet column indices for known destinations
UPDATE destinations
SET sheet_column_index = CASE code
  WHEN 'partner_7' THEN 4
  WHEN 'partner_1' THEN 5
  WHEN 'partner_2' THEN 6
  WHEN 'coop_b' THEN 7
  WHEN 'coop_a' THEN 8
  WHEN 'partner_4' THEN 9
  WHEN 'partner_5' THEN 10
  WHEN 'partner_6' THEN 11
  WHEN 'coop_c' THEN 12
  ELSE sheet_column_index
END;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'destinations'
ORDER BY ordinal_position;
