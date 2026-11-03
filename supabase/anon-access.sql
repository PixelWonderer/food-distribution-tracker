-- Enable anonymous access for demos and testing.
-- Run this LAST, after the main RLS policies, migrations and seeds.
--
-- WARNING: this lets anyone holding the anon key read AND write every table in the
-- public schema. That is intentional for a public demo; do not use it for real data.
-- Tighten (or skip) it for a production deployment.
--
-- The app reads and writes every table with the anon key (there is no sign-in), so rather
-- than listing tables one by one this enables RLS (if needed) and adds a single permissive
-- policy per public table. It is idempotent, and picks up tables added by later migrations.

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "Allow anon full access" ON public.%I', t.tablename);
    EXECUTE format(
      'CREATE POLICY "Allow anon full access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      t.tablename
    );
  END LOOP;
END $$;

-- Make sure the anon role can use the tables, sequences and RPC functions
-- (Supabase grants these by default; this is a no-op there but fixes hand-built databases).
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Volunteer contact details stay private even in a demo: anon reads only these columns
REVOKE ALL ON public.volunteers FROM anon, authenticated;
GRANT SELECT (id, slug, display_name, is_active, created_at, updated_at) ON public.volunteers TO anon, authenticated;

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
