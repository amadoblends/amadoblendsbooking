import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

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
