-- ============================================
-- Ops Hub Test Data Seed
-- Week of December 29, 2025 (FAKE demo data)
-- Run this in Supabase SQL Editor
-- ============================================

-- First, ensure tables exist (create if missing)
CREATE TABLE IF NOT EXISTS shift_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  content TEXT,
  timeline JSONB,
  checklist JSONB,
  location TEXT,
  location_url TEXT,
  icon TEXT,
  color TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_date TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_name TEXT NOT NULL,
  from_volunteer_id UUID REFERENCES volunteers(id),
  to_volunteer_id UUID REFERENCES volunteers(id),
  from_shift_type TEXT,
  to_shift_type TEXT,
  handoff_time TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coverage_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unavailable_volunteers JSONB,
  backup_decision_maker UUID REFERENCES volunteers(id),
  active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 1. VOLUNTEERS (upsert to avoid duplicates)
-- ============================================
INSERT INTO volunteers (id, slug, display_name, email, phone, is_active, notes)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'sam', 'Sam', 'sam@example.com', '555-0101', true, 'Coordinator, has truck'),
  ('22222222-2222-2222-2222-222222222222', 'alex', 'Alex', 'alex@example.com', '555-0102', true, 'Coordinator, Produce Market lead'),
  ('33333333-3333-3333-3333-333333333333', 'jordan', 'Jordan', 'jordan@example.com', '555-0103', true, 'Regular volunteer'),
  ('44444444-4444-4444-4444-444444444444', 'casey', 'Casey', 'casey@example.com', '555-0104', true, 'Regular volunteer'),
  ('55555555-5555-5555-5555-555555555555', 'riley', 'Riley', 'riley@example.com', '555-0105', true, 'Regular volunteer'),
  ('66666666-6666-6666-6666-666666666666', 'taylor', 'Taylor', 'taylor@example.com', '555-0106', true, 'Friday lead when Sam is out'),
  ('77777777-7777-7777-7777-777777777777', 'morgan', 'Morgan', 'morgan@example.com', '555-0107', true, 'Thursday evening helper')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  is_active = EXCLUDED.is_active,
  notes = EXCLUDED.notes;

-- ============================================
-- 2. SHIFT DETAILS (rich content per shift type)
-- ============================================
INSERT INTO shift_details (shift_type, display_name, description, icon, color, display_order, timeline, checklist, location, location_url, content)
VALUES
  ('produce_market', 'Produce Market', 'Thursday evening produce pickup from Produce Market. Lead coordinates truck and route.', '🚚', 'slate', 1,
   '[
     {"time": "~6:20pm", "task": "Drop your car at the lead''s place"},
     {"time": "~6:30pm", "task": "Walk to truck @ Community Center on Main St"},
     {"time": "~6:45pm", "task": "Pick up Jordan (call/text when 5 min away)"},
     {"time": "7:00pm", "task": "Produce Market pickup & sorting"},
     {"time": "~8:30pm", "task": "Load truck, begin route"},
     {"time": "~9:30pm", "task": "Return truck to the lead''s place, leave key hidden"}
   ]'::jsonb,
   '[
     {"item": "Truck key (if you have it)", "required": true},
     {"item": "Phone charger", "required": false},
     {"item": "Warm layers (warehouse is cold)", "required": false}
   ]'::jsonb,
   'Community Center, Main St',
   'https://maps.google.com/?q=Community+Center+Main+St',
   '## After Produce Market Route

**Partner Group 8** — Drop cakes, offer picks from sorted produce
**Garden** — Treats/groceries for gardeners (variable)
**Co-op C** — Produce boxes (1–2 boxes, optional depending on supply)
**Jordan''s** — Bring fridge items up the stairs
**Lead''s place** — Return truck, hide key in cab

## KEY HANDOFF — IMPORTANT
End of night: Leave truck key hidden in cab
→ Center area near cup holders, cover it with something
→ Morgan will grab it and bring inside for Taylor on Friday'),

  ('truck_loading', 'Truck Loading', 'Friday morning truck loading for distribution runs.', '📦', 'green', 2,
   '[
     {"time": "8:00am", "task": "Arrive at warehouse"},
     {"time": "8:15am", "task": "Check inventory list, pull items"},
     {"time": "9:00am", "task": "Load truck in order of delivery stops"},
     {"time": "9:30am", "task": "Depart for deliveries"}
   ]'::jsonb,
   '[
     {"item": "Truck key", "required": true},
     {"item": "Inventory checklist", "required": true},
     {"item": "Dolly/hand truck", "required": false}
   ]'::jsonb,
   'Food Bank Warehouse',
   'https://maps.google.com/?q=Example+Warehouse',
   NULL),

  ('grocery_distribution', 'Grocery Store Distribution', 'Friday Grocery Store pickup and distribution.', '🥬', 'green', 3,
   '[
     {"time": "10:00am", "task": "Arrive at Grocery Store loading dock"},
     {"time": "10:15am", "task": "Check in with manager, get pallets"},
     {"time": "10:45am", "task": "Load into truck"},
     {"time": "11:00am", "task": "Drive to first stop"},
     {"time": "12:00pm", "task": "Distribution complete"}
   ]'::jsonb,
   '[
     {"item": "ID badge", "required": true},
     {"item": "Gloves", "required": false}
   ]'::jsonb,
   'Example Grocery Store',
   'https://maps.google.com/?q=Example+Grocery+Store',
   NULL),

  ('saturday_distribution', 'Saturday Distribution', 'Main Saturday distribution at multiple locations.', '🏪', 'blue', 4,
   '[
     {"time": "9:00am", "task": "Load truck at warehouse"},
     {"time": "10:00am", "task": "Partner Group 6 setup"},
     {"time": "11:00am", "task": "Begin distribution"},
     {"time": "1:00pm", "task": "Pack up, move to next location"},
     {"time": "3:00pm", "task": "Finish all stops, return truck"}
   ]'::jsonb,
   '[
     {"item": "2 tables", "required": true},
     {"item": "Canopy tent", "required": true},
     {"item": "Signage", "required": false}
   ]'::jsonb,
   'Partner Group 6',
   'https://maps.google.com/?q=Example+Distribution+Site',
   '## Distribution Stops (in order)

1. **Partner Group 6** (11am-1pm) — Main distribution
2. **Partner Group 5** (1:30pm) — Smaller drop
3. **Partner Group 4** (2:30pm) — Final stop

## Setup Tips
- Arrive 30 min early for setup
- Canopy goes up first, then tables
- Keep cold items in coolers until needed'),

  ('saturday_evening_run', 'Saturday Evening Run', 'Evening deliveries to remaining locations.', '🌙', 'cyan', 5,
   '[
     {"time": "5:00pm", "task": "Load remaining items"},
     {"time": "5:30pm", "task": "Co-op C delivery"},
     {"time": "6:30pm", "task": "Final stops"},
     {"time": "7:30pm", "task": "Return truck, clean up"}
   ]'::jsonb,
   '[]'::jsonb,
   'Starting from warehouse',
   NULL,
   NULL),

  ('sunday_distribution', 'Sunday Distribution', 'Partner Group 7 prep and Sunday Meal Program distribution.', '🍲', 'orange', 6,
   '[
     {"time": "12:00pm", "task": "Arrive at Sunday Meal Program location"},
     {"time": "12:30pm", "task": "Setup tables and signage"},
     {"time": "1:00pm", "task": "Begin distribution"},
     {"time": "3:00pm", "task": "Pack up and clean"}
   ]'::jsonb,
   '[
     {"item": "Tables from storage", "required": true},
     {"item": "Serving utensils", "required": true}
   ]'::jsonb,
   'Sunday Meal Program Sunday Location',
   NULL,
   NULL)

ON CONFLICT (shift_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  display_order = EXCLUDED.display_order,
  timeline = EXCLUDED.timeline,
  checklist = EXCLUDED.checklist,
  location = EXCLUDED.location,
  location_url = EXCLUDED.location_url,
  content = EXCLUDED.content,
  updated_at = NOW();

-- ============================================
-- 3. SHIFT ASSIGNMENTS for week of 2025-12-29
-- ============================================
-- Clear existing and insert fresh
DELETE FROM shift_assignments WHERE week_date = '2025-12-29';

INSERT INTO shift_assignments (volunteer_id, week_date, shift_type, time_slot, notes, is_confirmed)
VALUES
  -- Thursday Evening - Produce Market
  ('11111111-1111-1111-1111-111111111111', '2025-12-29', 'produce_market', 'thursday_evening', 'Lead pickup. Route: Produce Market → Partner Group 8 → Garden → Jordan''s → Home', true),
  ('33333333-3333-3333-3333-333333333333', '2025-12-29', 'produce_market', 'thursday_evening', 'Helper for sorting and loading', true),
  ('77777777-7777-7777-7777-777777777777', '2025-12-29', 'produce_market', 'thursday_evening', 'Late helper - meet at Produce Market', false),

  -- Friday AM - Truck Loading
  ('66666666-6666-6666-6666-666666666666', '2025-12-29', 'truck_loading', 'friday_am', 'Taylor leads Friday while Sam is out', true),

  -- Friday Noon - Grocery Store Distribution
  ('66666666-6666-6666-6666-666666666666', '2025-12-29', 'grocery_distribution', 'friday_noon', 'Grocery Store + Co-op A', true),
  ('44444444-4444-4444-4444-444444444444', '2025-12-29', 'grocery_distribution', 'friday_noon', 'Distribution helper', false),

  -- Saturday AM - Distribution setup
  ('55555555-5555-5555-5555-555555555555', '2025-12-29', 'saturday_distribution', 'saturday_am', 'Setup at Partner Group 6', true),
  ('33333333-3333-3333-3333-333333333333', '2025-12-29', 'saturday_distribution', 'saturday_noon', 'Noon shift for main distribution', true),

  -- Saturday Evening
  ('44444444-4444-4444-4444-444444444444', '2025-12-29', 'saturday_evening_run', 'saturday_evening', 'Co-op C and final deliveries', true),

  -- Sunday
  ('55555555-5555-5555-5555-555555555555', '2025-12-29', 'sunday_distribution', 'sunday_afternoon', 'Sunday Meal Program prep', true),
  ('33333333-3333-3333-3333-333333333333', '2025-12-29', 'sunday_distribution', 'sunday_afternoon', 'Distribution helper', false);

-- ============================================
-- 4. HANDOFFS for week of 2025-12-29
-- ============================================
DELETE FROM handoffs WHERE week_date = '2025-12-29';

INSERT INTO handoffs (week_date, item_type, item_name, from_volunteer_id, to_volunteer_id, from_shift_type, to_shift_type, handoff_time, status, notes)
VALUES
  -- Truck Key Chain: Sam → Morgan → Taylor
  ('2025-12-29', 'truck_key', 'Truck Key',
   '11111111-1111-1111-1111-111111111111',  -- Sam
   '77777777-7777-7777-7777-777777777777',  -- Morgan
   'produce_market', 'truck_loading', 'thursday_evening', 'pending',
   'Sam leaves key hidden in truck cab (center console area, covered). Morgan retrieves and brings inside.'),

  ('2025-12-29', 'truck_key', 'Truck Key',
   '77777777-7777-7777-7777-777777777777',  -- Morgan
   '66666666-6666-6666-6666-666666666666',  -- Taylor
   'produce_market', 'truck_loading', 'friday_am', 'pending',
   'Morgan gives key to Taylor Friday morning for the day''s runs.'),

  -- Warehouse Code
  ('2025-12-29', 'door_code', 'Warehouse Door Code',
   NULL,  -- General knowledge
   '66666666-6666-6666-6666-666666666666',  -- Taylor
   NULL, 'truck_loading', 'friday_am', 'confirmed',
   'Code is shared in person — Taylor already knows it');

-- ============================================
-- 5. ACTION ITEMS for coordinators
-- ============================================
DELETE FROM action_items WHERE week_date = '2025-12-29';

INSERT INTO action_items (title, description, week_date, assigned_to, is_completed, priority, due_date)
VALUES
  ('Confirm all Thursday volunteers', 'Text Sam, Jordan, Morgan to confirm Thursday evening Produce Market shift', '2025-12-29', '22222222-2222-2222-2222-222222222222', true, 3, '2025-12-31'),

  ('Update truck key handoff chain', 'Make sure Morgan knows where to find key in truck', '2025-12-29', '11111111-1111-1111-1111-111111111111', false, 3, '2025-12-31'),

  ('Check Grocery Store schedule', 'Confirm Friday pickup time with Grocery Store manager', '2025-12-29', '66666666-6666-6666-6666-666666666666', false, 2, '2026-01-02'),

  ('Reserve tables for Sunday', 'Call Sunday Meal Program venue to confirm table availability', '2025-12-29', '55555555-5555-5555-5555-555555555555', false, 2, '2026-01-03'),

  ('Inventory check', 'Count remaining supplies before weekend runs', '2025-12-29', NULL, false, 1, '2026-01-02'),

  ('Post-weekend debrief', 'Schedule brief call with all volunteers for feedback', '2025-12-29', '22222222-2222-2222-2222-222222222222', false, 1, '2026-01-06');

-- ============================================
-- 6. COVERAGE SCENARIO (emergency mode)
-- ============================================
DELETE FROM coverage_scenarios;

INSERT INTO coverage_scenarios (name, description, unavailable_volunteers, backup_decision_maker, active)
VALUES
  ('Sam & Alex out of town',
   'Primary coverage: Taylor leads Friday, Riley/Casey/Jordan handle weekend. Emergency contact: Taylor',
   '["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"]'::jsonb,
   '66666666-6666-6666-6666-666666666666',  -- Taylor
   false),

  ('New Year''s Weekend Minimal',
   'Reduced operations for holiday weekend. Only essential distributions.',
   '[]'::jsonb,
   '11111111-1111-1111-1111-111111111111',  -- Sam
   false);

-- ============================================
-- DONE! Verify counts
-- ============================================
SELECT 'volunteers' as table_name, count(*) as row_count FROM volunteers WHERE is_active = true
UNION ALL
SELECT 'shift_details', count(*) FROM shift_details
UNION ALL
SELECT 'shift_assignments (this week)', count(*) FROM shift_assignments WHERE week_date = '2025-12-29'
UNION ALL
SELECT 'handoffs (this week)', count(*) FROM handoffs WHERE week_date = '2025-12-29'
UNION ALL
SELECT 'action_items (this week)', count(*) FROM action_items WHERE week_date = '2025-12-29'
UNION ALL
SELECT 'coverage_scenarios', count(*) FROM coverage_scenarios;
