import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether an account is finished, and what's missing if not.
 *
 * ── Two different "no" answers ───────────────────────────────────────────
 * Verifying a phone lets someone in. It does not make them a client. Between
 * those two states the app has to let them exist — see their own screen, be
 * asked for the rest — without letting them book.
 *
 * So there are three states, not two:
 *   no-profile  — the code worked, nothing else exists yet
 *   incomplete  — some fields are filled, some aren't
 *   complete    — everything works
 *
 * Which fields are missing comes from the database rather than being
 * recomputed here, so an old client with three of five fields is asked for
 * two, not for five.
 */

export type ProfileField = "first_name" | "last_name" | "email" | "birth_date" | "phone";

export interface ProfileState {
  state: "no-profile" | "incomplete" | "complete";
  /** Already verified, so the form shows it and never asks again. */
  phone: string | null;
  missing: ProfileField[];
}

const UNKNOWN: ProfileState = { state: "no-profile", phone: null, missing: [] };

/**
 * Cached per request: the layout asks, and so does every page under it.
 */
export const getProfileState = cache(async (): Promise<ProfileState> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_profile_state");

  /*
   * Before migration 37 the function doesn't exist. Treating everyone as
   * complete is the right fallback: the gate is new, and locking the whole
   * client base out of booking because a migration is pending would be a far
   * worse failure than not enforcing it yet.
   */
  if (error) return { state: "complete", phone: null, missing: [] };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return UNKNOWN;

  if (!row.has_profile) return { state: "no-profile", phone: row.phone ?? null, missing: [] };

  return {
    state: row.complete ? "complete" : "incomplete",
    phone: row.phone ?? null,
    missing: (row.missing ?? []) as ProfileField[],
  };
});

/** Everything the app does for a client needs a finished account. */
export function canUseApp(state: ProfileState): boolean {
  return state.state === "complete";
}
