import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Browser Supabase client — Realtime subscriptions and anon reads only.
 *
 * Spool does not use Supabase Auth. Sessions are the `spool_session` cookie, and
 * every write goes through a server route with the service-role key. The
 * `backfill_jobs` RLS policy deliberately grants `anon` SELECT for the Realtime
 * channel used by `useBackfillJob`.
 *
 * We use `@supabase/supabase-js` rather than `@supabase/ssr`'s
 * `createBrowserClient` because the latter hardcodes `persistSession: true` and
 * `autoRefreshToken: true` (see @supabase/ssr `createBrowserClient.js`). It then
 * reads any leftover `sb-*-auth-token` cookie and tries to refresh a Supabase
 * Auth session that does not exist, logging `AuthApiError: Invalid Refresh
 * Token: Refresh Token Not Found` on every page load.
 */
function buildClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}

let cachedClient: ReturnType<typeof buildClient> | null = null;

export function createClient() {
  cachedClient ??= buildClient();
  return cachedClient;
}
