import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who receives the shop's copy of an appointment notice.
 *
 * Resolved in order, first non-empty wins:
 *
 *   1. business_settings.notify_email — set from the panel, changeable
 *      without a redeploy. This is the one the barber actually controls.
 *   2. BARBER_NOTIFY_EMAIL — the env fallback, for before the setting exists.
 *   3. `fallback`, which the admin panel passes as the signed-in barber's own
 *      login address, so a fresh install still reaches somebody. The client
 *      app has no equivalent and passes nothing.
 *
 * Returns null only when all of them are missing; the caller treats that as
 * "skip the shop copy" rather than an error.
 */
export async function resolveBarberInbox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  fallback?: string | null
): Promise<string | null> {
  // The column arrives with migration 25; before that this simply errors and
  // we fall through, which is the correct behaviour rather than a crash.
  const { data: business } = await supabase
    .from("business_settings")
    .select("notify_email")
    .eq("id", 1)
    .maybeSingle();

  const fromSettings = business?.notify_email?.trim();
  if (fromSettings) return fromSettings;

  const fromEnv = process.env.BARBER_NOTIFY_EMAIL?.trim();
  if (fromEnv) return fromEnv;

  return fallback?.trim() || null;
}
