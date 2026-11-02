# Supabase Setup Guide

This guide walks through pointing the tracker at **your own** Supabase project.

## 1. Create a project

1. Sign in at <https://supabase.com> and click "New Project".
2. Pick a name, a strong database password, and a nearby region.

## 2. Get your API credentials

Settings -> API:

- **Project URL** (`VITE_SUPABASE_URL`)
- **anon / public key** (`VITE_SUPABASE_ANON_KEY`)

Only the anon key belongs in the frontend. Never put a service-role key in a `VITE_` variable or commit it.

## 3. Configure the app

```bash
cp .env.example .env
# edit .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

## 4. Create the schema

In the Supabase dashboard open **SQL Editor** and run, in order (each file once; a fresh project only):

1. `supabase/schema.sql` - base tables (orders, destinations, allocations, tracking, custom items, supplies). Destinations are added in step 6.
2. `supabase/rls_policies.sql` - row level security (review these before going to production)
3. `supabase/functions.sql` - database functions
4. `supabase/realtime.sql` - realtime configuration
5. Every file in `supabase/migrations/` in filename order, with the undated files first
   (`add_order_confirmation.sql`, ...) and then the dated ones (`20250101_...` onward). The file
   names are chosen so plain alphabetical order is correct, for example `20260121_b_...` must run
   after `20260121_add_inventory_tables.sql`. These create the Ops Hub, redirection, banking,
   inventory/Reserve, and confirmation tables and functions.
6. `supabase/date_free_functions.sql` - `get_all_week_data()`, `get_all_custom_items()`, and
   `get_all_supplies_status()`, which the app calls. They treat the newest `orders.week_date` as the
   current week, so no date has to be passed in. Run it after the migrations.
7. `supabase/seed-destinations.sql` - placeholder destinations (Co-op A/B/C, Partner Group 1-9)
8. Optional: `scripts/seed-ops-data.sql` - fake volunteers and shifts for the Ops Hub demo (needs
   the Ops Hub tables from step 5)
9. Optional (public demo): `supabase/anon-access.sql` - lets the anon key read and write every table.
   This is wide open on purpose; only use it for a demo or testing. Run it last so it also covers
   the tables created by the migrations.
10. Optional (public demo): `supabase/seed-demo-week.sql` - a realistic fake weekly order (27 items,
    178 allocations across the 14 destinations, a few Reserve items, sample confirmations, custom
    items, supplies, and an Ops Hub week). It needs steps 1-8 and uses the app's own import RPCs.
    The app treats the newest `orders.week_date` as the current "Pickup date", so the file stamps
    orders with a pickup Friday (`2026-11-06`) and the Ops Hub rows with that week's Monday
    (`2026-11-02`). Edit those two dates at the top of the file to demo a different week. It is safe
    to re-run: it replaces the whole week, like "Clear & Import" in the app.

Other `.sql` files in `supabase/` (`schema_optimized.sql`, `functions_optimized.sql`,
`add_missing_columns.sql`, `final_clear_function.sql`, `replace_week_data.sql`,
`update_sheet_column_order.sql`) are older alternatives kept for reference; do not run them on a new
project. `supabase/one-off/` holds one-time data backfills for existing databases, also not needed on
a fresh project.

## 5. Test the connection

```bash
npm run test:supabase
```

## Troubleshooting

- **Nothing loads / auth errors**: check the values in `.env` and restart `npm run dev`.
- **Realtime not updating**: make sure `realtime.sql` was applied and replication is enabled for the tables.
- **RLS errors**: confirm the policies in `rls_policies.sql` allow the actions you are attempting.
