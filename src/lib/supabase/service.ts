import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A Supabase client that bypasses RLS, for work nobody is signed in for.
 *
 * ── The only thing this is for ───────────────────────────────────────────
 * Reminders fire on a schedule, with no user session behind them, so they
 * can't go through the normal client — RLS would (correctly) refuse. The
 * queue functions are revoked from `authenticated` for the same reason: only
 * this key can claim them.
 *
 * ── Rules for the key ────────────────────────────────────────────────────
 * SUPABASE_SERVICE_ROLE_KEY must:
 *   • live only in the environment, never in a file, never in git
 *   • never carry the NEXT_PUBLIC_ prefix — it must not reach a browser
 *   • be used only from server code that no request body can influence
 *
 * It is read here and nowhere else, so there is one place to audit.
 *
 * Returns null when it isn't set. That's a normal state during setup: the
 * caller reports "not configured" instead of crashing, and everything a
 * signed-in user does keeps working through the ordinary client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceClient(): SupabaseClient<any, any, any> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      // No session to persist or refresh — this client is never a person
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
