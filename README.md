# Food Distribution Tracker

A mobile-first web app that helps volunteer-run food groups move a weekly food-bank order from the loading dock to people's hands. It started as an internal tool for a mutual-aid food group and has been sanitized for public contribution.

> **All group names, partner names, people, quantities, and data in this repo are placeholders** (for example "Co-op A", "Partner Group 3", "Food Bank"). Nothing here refers to real organizations or people. Bring your own groups and your own Supabase project.

## What it does

The weekly flow the app supports:

1. **Order** - the Food Bank order is imported (from a Google Sheet via an Apps Script web app, or seeded directly into Supabase). Each item is allocated across destinations: co-ops (Co-op A/B/C) and partner groups (Partner Group 1-9).
2. **Confirm** - volunteers check the delivery against the order in the *Order Confirmation* tab and flag anything short, missing, or ran out.
3. **Storage** - confirmed items are sorted into fridge / table storage and checked off in the *Storage* tab. A separate **Reserve** section holds stock that is not allocated to any destination (a held-back reserve for community kitchens or later use).
4. **Pickup** - each destination's items appear in the *Pickup* tab by timing slot (Friday AM, Saturday noon, ...). Volunteers check items off as they are packed and handed over, and can redirect items between destinations.
5. **Inventory** - browse, count, and reorder what is left on the shelves.

There is also an **Ops Hub** (`/ops`) for shift schedules, hand-offs, and coverage planning, a local-only volunteer **Portal** (`/portal`, reads fake data from `demo-data/volunteers/`), and **Admin** tools (`/admin`) for destination schedules and splitting a destination's items across days or other partner groups. Data syncs in real time through Supabase.

Stack: React 19, TypeScript, Vite, Tailwind CSS, Zustand, Supabase (Postgres + Realtime), Vitest.

## Quick start

```bash
git clone <your fork>
cd <repo>
npm install
cp .env.example .env     # then fill in your own Supabase values (see below)
npm run dev              # http://localhost:3000
```

`npm run build` produces a static bundle in `dist/` that can be hosted anywhere (Netlify, Vercel, GitHub Pages, S3, ...). Without Supabase credentials the app still builds and loads; use the in-app demo mode to explore it.

## Run it against your own Supabase project

1. Create a free project at <https://supabase.com>.
2. Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL` - Settings -> API -> Project URL
   - `VITE_SUPABASE_ANON_KEY` - Settings -> API -> anon / public key
   - Never use a service-role key in the frontend, and never commit `.env`.
3. In the Supabase SQL Editor, run the schema (details in [`supabase/SETUP_GUIDE.md`](supabase/SETUP_GUIDE.md)):
   - `supabase/schema.sql`, `supabase/rls_policies.sql`, `supabase/functions.sql`, `supabase/realtime.sql`
   - then every file in `supabase/migrations/` in filename order
   - then `supabase/seed-destinations.sql` for placeholder destinations
   - optionally `scripts/seed-ops-data.sql` for fake Ops Hub volunteers and shifts
4. Optional integrations (all off unless configured in `.env`): Google Sheets sync (`VITE_SHEETS_WEBAPP_URL`), a door-unlock webhook (`VITE_DOOR_UNLOCK_URL`), and a source-sheet link (`VITE_SOURCE_SHEET_URL`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run test:run` | Run unit tests once |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript check |

## Project layout

```
src/app/         UI: views, modals, admin, ops, portal, tutorial
src/services/    Supabase data layer, sheet sync, state stores
src/utils/       constants (destinations, emoji map), helpers
supabase/        schema, RLS, functions, migrations, seeds
demo-data/       fake volunteer data for the local portal
vite-plugins/    dev-server API for the portal demo data
```

Destinations are defined in `src/utils/constants.ts` (`GROUPS`, `COLUMN_MAP`) and seeded in `supabase/seed-destinations.sql`. To use your own groups, rename them in both places (keep the codes in sync).

## How to contribute

1. Fork this repository and create a branch (`git checkout -b my-change`).
2. Make your change; run `npm run build` and `npm run test:run` before you push.
3. Open a pull request describing what changed and why. Small, focused PRs are easiest to review.
4. Please do **not** commit real keys, real partner/volunteer names, or real data. Use placeholders.

Ideas that would help: accessibility passes, offline support, better demo mode, i18n, test coverage, docs.

## License

MIT - see [LICENSE](LICENSE).
