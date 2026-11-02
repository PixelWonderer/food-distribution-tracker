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

In the Supabase dashboard open **SQL Editor** and run, in order:

1. `supabase/schema.sql` - base tables
2. `supabase/rls_policies.sql` - row level security (review these before going to production)
3. `supabase/functions.sql` - database functions
4. `supabase/realtime.sql` - realtime configuration
5. Every file in `supabase/migrations/` in filename order (older, undated files such as
   `add_order_confirmation.sql` first)
6. `supabase/seed-destinations.sql` - placeholder destinations (Co-op A/B/C, Partner Group 1-9)
7. Optional: `scripts/seed-ops-data.sql` - fake volunteers and shifts for the Ops Hub demo

`supabase/anon-access.sql` grants the anon role access for quick demos. Tighten the policies if your data is sensitive.

## 5. Test the connection

```bash
npm run test:supabase
```

## Troubleshooting

- **Nothing loads / auth errors**: check the values in `.env` and restart `npm run dev`.
- **Realtime not updating**: make sure `realtime.sql` was applied and replication is enabled for the tables.
- **RLS errors**: confirm the policies in `rls_policies.sql` allow the actions you are attempting.
