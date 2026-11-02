-- Seed destination data for Food Tracker
-- Based on the groups configuration from CLAUDE.md

INSERT INTO destinations (code, name, short_name, timing, is_direct, sheet_column_index, display_order) VALUES
  ('partner_1', 'Partner Group 1', 'Partner Group 1', 'Friday AM', true, 5, 1),
  ('partner_2', 'Partner Group 2', 'Partner Group 2', 'Friday AM', true, 6, 2),
  ('coop_a', 'Co-op A', 'Co-op A', 'Friday pm', false, 8, 3),
  ('coop_b', 'Co-op B', 'CO-B', 'Friday pm', false, 7, 4),
  ('partner_5', 'Partner Group 5', 'Partner Group 5', 'Saturday noon', false, 10, 5),
  ('partner_6', 'Partner Group 6', 'Partner 6', 'Saturday noon', false, 11, 6),
  ('partner_4', 'Partner Group 4', 'Partner Group 4', 'Saturday PM', false, 9, 7),
  ('coop_c', 'Co-op C', 'Co-op C', 'Saturday PM', false, 12, 8),
  ('partner_7', 'Partner Group 7', 'Partner Group 7', 'Sunday', false, 4, 9)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  timing = EXCLUDED.timing,
  is_direct = EXCLUDED.is_direct,
  sheet_column_index = EXCLUDED.sheet_column_index,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
