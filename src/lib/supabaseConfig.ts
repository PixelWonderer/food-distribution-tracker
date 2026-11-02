/**
 * Single source of truth for Supabase connection config.
 *
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a local `.env` file
 * (copy `.env.example`). Never commit real keys, and never put a service_role
 * key in frontend code.
 *
 * The fallbacks below are inert placeholders so the app can still build and
 * render its demo mode without a backend.
 */
export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'http://localhost:54321';

export const SUPABASE_ANON_KEY: string =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'missing-anon-key';

export const IS_SUPABASE_CONFIGURED: boolean = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

if (!IS_SUPABASE_CONFIGURED) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase is not configured. Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}
