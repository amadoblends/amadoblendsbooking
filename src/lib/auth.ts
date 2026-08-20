import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { NO_ROLES, type AccountRoles } from "@/lib/account-role";

/**
 * The signed-in user, fetched at most once per request.
 *
 * `supabase.auth.getUser()` is a network call to Supabase's /auth/v1/user
 * endpoint, not a local read — roughly 100–250ms each time. A single page
 * load was paying it in the layout and again in the page. React's `cache()`
 * de-duplicates them within one request.
 */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The signed-in client's row, also once per request. Most screens need this
 * rather than the raw auth user.
 */
export const getClientRecord = cache(
  async (): Promise<{ id: string; full_name: string; first_name: string | null } | null> => {
    const user = await getUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, first_name")
      .eq("user_id", user.id)
      .maybeSingle();
    return data ?? null;
  }
);

/**
 * The roles the signed-in account actually holds.
 *
 * Read from the database rather than inferred from having a client profile:
 * a barber signing in here has no client row, but neither does a brand-new
 * client who hasn't finished setting up — and those two need opposite
 * answers.
 */
export const getRoles = cache(async (): Promise<AccountRoles> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_roles");

  /*
   * Before migration 34 there is no my_roles(). Falling back to "everyone is
   * a client" keeps this app working exactly as it did; the migration is what
   * actually separates the two.
   */
  if (error) return { ...NO_ROLES, isClient: true };

  const row = Array.isArray(data) ? data[0] : data;
  return {
    isBarber: Boolean(row?.is_barber),
    isClient: Boolean(row?.is_client),
  };
});
