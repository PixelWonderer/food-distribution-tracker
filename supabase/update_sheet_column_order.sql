-- Update destination column indices to match the reordered Google Sheet
-- Run this in Supabase SQL editor.

ALTER TABLE destinations
ADD COLUMN IF NOT EXISTS sheet_column_index INTEGER DEFAULT -1;

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

-- Optional: verify the values
SELECT code, name, sheet_column_index
FROM destinations
ORDER BY sheet_column_index;
