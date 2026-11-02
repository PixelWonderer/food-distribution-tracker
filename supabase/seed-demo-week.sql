-- Optional: seed a realistic FAKE weekly order for a public demo.
--
-- Run AFTER every step in SETUP_GUIDE.md section 4 (it uses the app's own import RPCs and
-- copies the Ops Hub sample week from scripts/seed-ops-data.sql). Safe to re-run: the
-- import RPC clears and replaces the whole week, exactly like "Clear & Import" in the app.
--
-- The app treats the newest orders.week_date as "this week" (get_all_week_data uses
-- MAX(week_date)), and shows it as the "Pickup date". Orders are therefore stamped with the
-- pickup Friday. The Ops Hub keys shifts/handoffs/action items to the MONDAY of the week
-- (getMonday() in src/types/ops.ts), so those are seeded for the Monday.
--
--   pickup date (orders, custom items, supplies, tasks):  2026-11-06  (Friday)
--   Ops Hub week (shifts, handoffs, action items):        2026-11-02  (Monday)
--
-- To demo another week, change the two dates below (search for 2026-11-06 / 2026-11-02).
-- All names are placeholders; quantities are cases.

-- 1. Orders + allocations (27 items, 178 allocations) through the app's import RPC
SELECT clear_and_import_week_data(
  $orders$
[
  {"item_name":"Apples, Fuji 40lb","quantity":14,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Bananas, 40lb","quantity":9,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Carrots, 25lb","quantity":14.0,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":2},
  {"item_name":"Yellow Onions, 50lb","quantity":9,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Russet Potatoes, 50lb","quantity":11,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Romaine Hearts, 24ct","quantity":8,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Roma Tomatoes, 25lb","quantity":7,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Bell Peppers, 11lb","quantity":5,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Green Cabbage, 50lb","quantity":7.5,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":1},
  {"item_name":"Navel Oranges, 40lb","quantity":9,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Pinto Beans, 24/1lb","quantity":16,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":2},
  {"item_name":"Black Beans, 24/1lb","quantity":10,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":1},
  {"item_name":"White Rice, 20/1lb","quantity":17,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":2},
  {"item_name":"Spaghetti, 20/1lb","quantity":8,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Pasta Sauce, 24/15oz","quantity":8,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Diced Tomatoes, 12/28oz","quantity":7,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Sweet Corn, 24/15oz","quantity":6,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Peanut Butter, 12/16oz","quantity":8,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Milk, 2% Gallon 4ct","quantity":10,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Eggs, Large 15dz","quantity":6,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Cheddar Cheese, 12/8oz","quantity":5,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Plain Yogurt, 6/32oz","quantity":5,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Butter, 36/1lb","quantity":2,"unit":"Case","storage_type":"Fridge","ran_out":false,"non_allocated":0},
  {"item_name":"Sandwich Bread, 8/20oz","quantity":14,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Flour Tortillas, 12/12ct","quantity":8,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Hamburger Buns, 8/8ct","quantity":6,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0},
  {"item_name":"Plain Bagels, 6/6ct","quantity":4,"unit":"Case","storage_type":"Pantry","ran_out":false,"non_allocated":0}
]
  $orders$::jsonb,
  $allocs$
[
  {"item_name":"Apples, Fuji 40lb","destination_code":"partner_1","quantity":2},
  {"item_name":"Apples, Fuji 40lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Apples, Fuji 40lb","destination_code":"partner_3","quantity":1},
  {"item_name":"Apples, Fuji 40lb","destination_code":"coop_a","quantity":2},
  {"item_name":"Apples, Fuji 40lb","destination_code":"coop_b","quantity":2},
  {"item_name":"Apples, Fuji 40lb","destination_code":"coop_c","quantity":2},
  {"item_name":"Apples, Fuji 40lb","destination_code":"partner_5","quantity":1},
  {"item_name":"Apples, Fuji 40lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Apples, Fuji 40lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"coop_a","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"partner_4","quantity":1},
  {"item_name":"Bananas, 40lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Bananas, 40lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Carrots, 25lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Carrots, 25lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Carrots, 25lb","destination_code":"coop_a","quantity":2},
  {"item_name":"Carrots, 25lb","destination_code":"coop_b","quantity":1.5},
  {"item_name":"Carrots, 25lb","destination_code":"coop_c","quantity":1.5},
  {"item_name":"Carrots, 25lb","destination_code":"partner_8","quantity":1},
  {"item_name":"Carrots, 25lb","destination_code":"partner_5","quantity":1},
  {"item_name":"Carrots, 25lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Carrots, 25lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"partner_3","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"coop_a","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"partner_4","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"partner_5","quantity":1},
  {"item_name":"Yellow Onions, 50lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"coop_a","quantity":2},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"coop_c","quantity":2},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"partner_9","quantity":1},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Russet Potatoes, 50lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"partner_1","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"partner_3","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"coop_a","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"coop_b","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"partner_8","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"partner_5","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"partner_6","quantity":1},
  {"item_name":"Romaine Hearts, 24ct","destination_code":"partner_7","quantity":1},
  {"item_name":"Roma Tomatoes, 25lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Roma Tomatoes, 25lb","destination_code":"partner_3","quantity":1},
  {"item_name":"Roma Tomatoes, 25lb","destination_code":"coop_a","quantity":1},
  {"item_name":"Roma Tomatoes, 25lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Roma Tomatoes, 25lb","destination_code":"partner_4","quantity":1},
  {"item_name":"Roma Tomatoes, 25lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Bell Peppers, 11lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Bell Peppers, 11lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Bell Peppers, 11lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Bell Peppers, 11lb","destination_code":"partner_5","quantity":1},
  {"item_name":"Bell Peppers, 11lb","destination_code":"partner_6","quantity":1},
  {"item_name":"Green Cabbage, 50lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Green Cabbage, 50lb","destination_code":"coop_a","quantity":1},
  {"item_name":"Green Cabbage, 50lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Green Cabbage, 50lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Green Cabbage, 50lb","destination_code":"partner_6","quantity":1.5},
  {"item_name":"Green Cabbage, 50lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"partner_3","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"coop_a","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"partner_9","quantity":1},
  {"item_name":"Navel Oranges, 40lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Navel Oranges, 40lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"partner_1","quantity":2},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"coop_a","quantity":3},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"coop_b","quantity":2},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"coop_c","quantity":2},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"partner_4","quantity":1},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"partner_5","quantity":1},
  {"item_name":"Pinto Beans, 24/1lb","destination_code":"partner_6","quantity":2},
  {"item_name":"Black Beans, 24/1lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Black Beans, 24/1lb","destination_code":"partner_3","quantity":1},
  {"item_name":"Black Beans, 24/1lb","destination_code":"coop_a","quantity":2},
  {"item_name":"Black Beans, 24/1lb","destination_code":"coop_b","quantity":2},
  {"item_name":"Black Beans, 24/1lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Black Beans, 24/1lb","destination_code":"partner_9","quantity":1},
  {"item_name":"Black Beans, 24/1lb","destination_code":"partner_6","quantity":1},
  {"item_name":"White Rice, 20/1lb","destination_code":"partner_1","quantity":2},
  {"item_name":"White Rice, 20/1lb","destination_code":"partner_2","quantity":1},
  {"item_name":"White Rice, 20/1lb","destination_code":"coop_a","quantity":3},
  {"item_name":"White Rice, 20/1lb","destination_code":"coop_b","quantity":2},
  {"item_name":"White Rice, 20/1lb","destination_code":"coop_c","quantity":2},
  {"item_name":"White Rice, 20/1lb","destination_code":"partner_8","quantity":1},
  {"item_name":"White Rice, 20/1lb","destination_code":"partner_5","quantity":1},
  {"item_name":"White Rice, 20/1lb","destination_code":"partner_6","quantity":2},
  {"item_name":"White Rice, 20/1lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"partner_1","quantity":1},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"coop_a","quantity":2},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"coop_b","quantity":1},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"coop_c","quantity":1},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"partner_4","quantity":1},
  {"item_name":"Spaghetti, 20/1lb","destination_code":"partner_7","quantity":1},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"partner_1","quantity":1},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"partner_2","quantity":1},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"coop_a","quantity":2},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"coop_b","quantity":1},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"coop_c","quantity":1},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"partner_4","quantity":1},
  {"item_name":"Pasta Sauce, 24/15oz","destination_code":"partner_7","quantity":1},
  {"item_name":"Diced Tomatoes, 12/28oz","destination_code":"coop_a","quantity":2},
  {"item_name":"Diced Tomatoes, 12/28oz","destination_code":"coop_b","quantity":1},
  {"item_name":"Diced Tomatoes, 12/28oz","destination_code":"coop_c","quantity":2},
  {"item_name":"Diced Tomatoes, 12/28oz","destination_code":"partner_3","quantity":1},
  {"item_name":"Diced Tomatoes, 12/28oz","destination_code":"partner_6","quantity":1},
  {"item_name":"Sweet Corn, 24/15oz","destination_code":"partner_1","quantity":1},
  {"item_name":"Sweet Corn, 24/15oz","destination_code":"coop_a","quantity":1},
  {"item_name":"Sweet Corn, 24/15oz","destination_code":"coop_b","quantity":1},
  {"item_name":"Sweet Corn, 24/15oz","destination_code":"coop_c","quantity":1},
  {"item_name":"Sweet Corn, 24/15oz","destination_code":"partner_5","quantity":1},
  {"item_name":"Sweet Corn, 24/15oz","destination_code":"partner_9","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"partner_1","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"partner_2","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"partner_3","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"coop_a","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"coop_b","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"coop_c","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"partner_8","quantity":1},
  {"item_name":"Peanut Butter, 12/16oz","destination_code":"partner_6","quantity":1},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_1","quantity":2},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_2","quantity":1},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_3","quantity":1},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_8","quantity":1},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_5","quantity":1},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_6","quantity":3},
  {"item_name":"Milk, 2% Gallon 4ct","destination_code":"partner_7","quantity":1},
  {"item_name":"Eggs, Large 15dz","destination_code":"partner_1","quantity":1},
  {"item_name":"Eggs, Large 15dz","destination_code":"partner_2","quantity":1},
  {"item_name":"Eggs, Large 15dz","destination_code":"partner_3","quantity":1},
  {"item_name":"Eggs, Large 15dz","destination_code":"partner_6","quantity":2},
  {"item_name":"Eggs, Large 15dz","destination_code":"partner_7","quantity":1},
  {"item_name":"Cheddar Cheese, 12/8oz","destination_code":"partner_1","quantity":1},
  {"item_name":"Cheddar Cheese, 12/8oz","destination_code":"partner_2","quantity":1},
  {"item_name":"Cheddar Cheese, 12/8oz","destination_code":"partner_8","quantity":1},
  {"item_name":"Cheddar Cheese, 12/8oz","destination_code":"partner_5","quantity":1},
  {"item_name":"Cheddar Cheese, 12/8oz","destination_code":"partner_6","quantity":1},
  {"item_name":"Plain Yogurt, 6/32oz","destination_code":"partner_1","quantity":1},
  {"item_name":"Plain Yogurt, 6/32oz","destination_code":"partner_3","quantity":1},
  {"item_name":"Plain Yogurt, 6/32oz","destination_code":"partner_4","quantity":1},
  {"item_name":"Plain Yogurt, 6/32oz","destination_code":"partner_6","quantity":2},
  {"item_name":"Butter, 36/1lb","destination_code":"partner_2","quantity":1},
  {"item_name":"Butter, 36/1lb","destination_code":"partner_6","quantity":1},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"partner_1","quantity":2},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"partner_2","quantity":1},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"partner_3","quantity":1},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"coop_a","quantity":2},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"coop_b","quantity":1},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"coop_c","quantity":1},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"partner_8","quantity":1},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"partner_6","quantity":3},
  {"item_name":"Sandwich Bread, 8/20oz","destination_code":"partner_7","quantity":2},
  {"item_name":"Flour Tortillas, 12/12ct","destination_code":"partner_1","quantity":1},
  {"item_name":"Flour Tortillas, 12/12ct","destination_code":"coop_a","quantity":2},
  {"item_name":"Flour Tortillas, 12/12ct","destination_code":"coop_b","quantity":1},
  {"item_name":"Flour Tortillas, 12/12ct","destination_code":"coop_c","quantity":1},
  {"item_name":"Flour Tortillas, 12/12ct","destination_code":"partner_9","quantity":1},
  {"item_name":"Flour Tortillas, 12/12ct","destination_code":"partner_6","quantity":2},
  {"item_name":"Hamburger Buns, 8/8ct","destination_code":"partner_1","quantity":1},
  {"item_name":"Hamburger Buns, 8/8ct","destination_code":"partner_5","quantity":1},
  {"item_name":"Hamburger Buns, 8/8ct","destination_code":"partner_6","quantity":2},
  {"item_name":"Hamburger Buns, 8/8ct","destination_code":"partner_7","quantity":2},
  {"item_name":"Plain Bagels, 6/6ct","destination_code":"partner_2","quantity":1},
  {"item_name":"Plain Bagels, 6/6ct","destination_code":"partner_3","quantity":1},
  {"item_name":"Plain Bagels, 6/6ct","destination_code":"partner_8","quantity":1},
  {"item_name":"Plain Bagels, 6/6ct","destination_code":"partner_6","quantity":1}
]
  $allocs$::jsonb,
  '2026-11-06'
);

-- 2. Reserve: items with a non-allocated amount are imported into the inventory (Reserve section),
--    same call the app makes after an import.
SELECT * FROM import_non_allocated_to_inventory('2026-11-06');

-- 3. Mid-week progress so the tabs have something to show: a few items confirmed at pickup,
--    and the confirmed fridge items stored.
SELECT confirm_item_at_expected(o.id, 'Demo Volunteer')
FROM orders o
WHERE o.week_date = '2026-11-06'
  AND o.item_name IN ('Carrots, 25lb', 'Green Cabbage, 50lb', 'Milk, 2% Gallon 4ct', 'Eggs, Large 15dz',
                      'Pinto Beans, 24/1lb', 'White Rice, 20/1lb', 'Sandwich Bread, 8/20oz');

INSERT INTO storage_tracking (allocation_id, is_stored, stored_by, stored_at)
SELECT a.id, true, 'Demo Volunteer', NOW() - INTERVAL '2 hours'
FROM allocations a
JOIN orders o ON o.id = a.order_id
WHERE o.week_date = '2026-11-06'
  AND o.storage_type = 'Fridge'
  AND a.is_confirmed
ON CONFLICT (allocation_id) DO UPDATE SET is_stored = true, stored_by = EXCLUDED.stored_by, stored_at = EXCLUDED.stored_at;

-- 4. Items added by hand in the app (custom items) and supplies checklist
INSERT INTO custom_items (destination_id, week_date, item_name, quantity, unit, added_by)
SELECT d.id, '2026-11-06', v.item_name, v.quantity, v.unit, 'Demo Volunteer'
FROM (VALUES
  ('partner_3', 'Paper grocery bags', 40, 'bags'),
  ('coop_a',    'Compost bucket liners', 2, 'boxes'),
  ('partner_6', 'Donated birthday cake', 1, 'cake')
) AS v(code, item_name, quantity, unit)
JOIN destinations d ON d.code = v.code
WHERE NOT EXISTS (
  SELECT 1 FROM custom_items c WHERE c.destination_id = d.id AND c.week_date = '2026-11-06' AND c.item_name = v.item_name
);

INSERT INTO supplies (destination_id, week_date, supply_type, is_packed, quantity)
SELECT d.id, '2026-11-06', v.supply_type, v.is_packed, v.quantity
FROM (VALUES
  ('coop_a', 'mealBoxes', true, 30), ('coop_a', 'forks', true, 30), ('coop_a', 'napkins', false, 60),
  ('coop_b', 'mealBoxes', false, 25), ('coop_b', 'forks', false, 25),
  ('coop_c', 'mealBoxes', false, 40), ('coop_c', 'forks', false, 40), ('coop_c', 'napkins', false, 80)
) AS v(code, supply_type, is_packed, quantity)
JOIN destinations d ON d.code = v.code
ON CONFLICT (destination_id, week_date, supply_type) DO NOTHING;

-- 5. Pickup-day task checklist (Pickup tab), knowledge base, surplus groups
INSERT INTO shift_tasks (title, description, emoji, timing, display_order)
SELECT v.title, v.description, v.emoji, v.timing, v.display_order
FROM (VALUES
  ('Unlock the Hub and turn on the fridge', 'Door code is in the Knowledge Base', '🔑', 'friday am', 1),
  ('Count crates against the order', 'Use the Order tab; flag shortages as ran out', '📋', 'friday am', 2),
  ('Load the truck in stop order', 'Co-ops last, so they come off first', '🚚', 'friday pm', 1),
  ('Wipe down tables and return crates', NULL, '🧽', 'saturday noon', 1),
  ('Text the Sunday lead what is left over', NULL, '💬', 'sunday', 1)
) AS v(title, description, emoji, timing, display_order)
WHERE NOT EXISTS (SELECT 1 FROM shift_tasks);

INSERT INTO kb_articles (slug, title, content, category, display_order)
VALUES
  ('welcome-to-the-demo', 'Welcome to the demo', E'This is a public demo with **fake data**. Everything you change here is visible to other visitors and is reset periodically.\n\n- **Order** tab: confirm what arrived from the Food Bank\n- **Storage** tab: pack the Reserve and fridge items\n- **Pickup** tab: check items off per destination\n- **Ops** tab: shifts, handoffs, and action items', 'general', 1),
  ('friday-pickup-checklist', 'Friday pickup checklist', E'1. Unlock the Hub and turn on the walk-in fridge\n2. Count crates against the order\n3. Load the truck in stop order\n4. Text the shift lead when you leave', 'procedures', 1),
  ('hub-and-stops', 'Hub and stops', E'**Hub**: the central warehouse where the Food Bank order is received.\n\nStops: Co-op A, Co-op B, Co-op C, and Partner Groups 1-9. Timings are shown on the Pickup tab.', 'locations', 1)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO surplus_groups (group_name)
SELECT v.group_name
FROM (VALUES ('Partner Group 1'), ('Partner Group 5'), ('Partner Group 7')) AS v(group_name)
WHERE NOT EXISTS (SELECT 1 FROM surplus_groups g WHERE g.group_name = v.group_name);

-- 6. Ops Hub week (Monday 2026-11-02): reuse the sample shifts, handoffs, and action items that
--    scripts/seed-ops-data.sql created for 2025-12-29 (setup step 7), moved forward 308 days.
DELETE FROM shift_assignments WHERE week_date = '2026-11-02';
INSERT INTO shift_assignments (volunteer_id, week_date, shift_type, time_slot, notes, is_confirmed)
SELECT volunteer_id, '2026-11-02', shift_type, time_slot, notes, is_confirmed
FROM shift_assignments WHERE week_date = '2025-12-29';

DELETE FROM handoffs WHERE week_date = '2026-11-02';
INSERT INTO handoffs (week_date, item_type, item_name, from_volunteer_id, to_volunteer_id, from_shift_type, to_shift_type, handoff_time, status, notes)
SELECT '2026-11-02', item_type, item_name, from_volunteer_id, to_volunteer_id, from_shift_type, to_shift_type, handoff_time, status, notes
FROM handoffs WHERE week_date = '2025-12-29';

DELETE FROM action_items WHERE week_date = '2026-11-02';
INSERT INTO action_items (title, description, week_date, assigned_to, is_completed, priority, due_date)
SELECT title, description, '2026-11-02', assigned_to, is_completed, priority, due_date + INTERVAL '308 days'
FROM action_items WHERE week_date = '2025-12-29';
