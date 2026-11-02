-- Seed destination data for Food Tracker (placeholder names).
-- Groups, timings, and sheet columns mirror src/utils/constants.ts (GROUPS / COLUMN_MAP).
-- Partner Groups 1-9 plus Co-ops A/B/C. Safe to re-run (upserts on code).

INSERT INTO destinations (code, name, short_name, timing, default_timing, is_direct, sheet_column_index, display_order) VALUES
  ('partner_1', 'Partner Group 1', 'Partner Group 1', 'Friday AM',     'Friday AM',     true,  5,  1),
  ('partner_2', 'Partner Group 2', 'Partner Group 2', 'Friday AM',     'Friday AM',     true,  6,  2),
  ('partner_3', 'Partner Group 3', 'Partner Group 3', 'Friday AM',     'Friday AM',     true,  7,  3),
  ('coop_a',    'Co-op A',         'Co-op A',         'Friday pm',     'Friday pm',     false, 9,  4),
  ('coop_b',    'Co-op B',         'Co-op B',         'Friday pm',     'Friday pm',     false, 8,  5),
  ('partner_8', 'Partner Group 8', 'Partner Group 8', 'Friday pm',     'Friday pm',     false, -1, 6),
  ('partner_4', 'Partner Group 4', 'Partner Group 4', 'Friday pm',     'Friday pm',     false, 10, 7),
  ('coop_c',    'Co-op C',         'Co-op C',         'Friday pm',     'Friday pm',     false, 13, 8),
  ('partner_9', 'Partner Group 9', 'Partner Group 9', 'Saturday am',   'Saturday am',   false, -1, 9),
  ('partner_5', 'Partner Group 5', 'Partner Group 5', 'Saturday am',   'Saturday am',   false, 11, 10),
  ('partner_6', 'Partner Group 6', 'Partner 6',       'Saturday noon', 'Saturday noon', false, 12, 11),
  ('partner_7', 'Partner Group 7', 'Partner Group 7', 'Sunday',        'Sunday',        false, 4,  12)
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  timing = EXCLUDED.timing,
  default_timing = EXCLUDED.default_timing,
  is_direct = EXCLUDED.is_direct,
  sheet_column_index = EXCLUDED.sheet_column_index,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
