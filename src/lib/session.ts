import { createClient } from "@/lib/supabase/server";

export const INACTIVITY_DAYS = 30;
const TOUCH_AFTER_MINUTES = 60;

export interface SessionClient {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  language: "es" | "en";
  avatar_url: string | null;
}

/**
 * Loads the signed-in client and keeps `last_seen_at` fresh.
 * Returns `needsVerification` when the account has been idle past the
 * inactivity window — the caller redirects to /verificar.
 */
export async function getSessionClient(): Promise<
  | { state: "anonymous" }
  | { state: "no-profile" }
  | { state: "needs-verification"; client: SessionClient }
  | { state: "ok"; client: SessionClient }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { state: "anonymous" };

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, first_name, last_name, language, avatar_url, last_seen_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) return { state: "no-profile" };

  const shaped: SessionClient = {
    id: client.id,
    full_name: client.full_name,
    first_name: client.first_name,
    last_name: client.last_name,
    language: (client.language ?? "es") as "es" | "en",
    avatar_url: client.avatar_url,
  };

  const lastSeen = new Date(client.last_seen_at ?? 0).getTime();
  const idleMs = Date.now() - lastSeen;

  if (idleMs > INACTIVITY_DAYS * 24 * 3600_000) {
    return { state: "needs-verification", client: shaped };
  }

  // Throttled write: once an hour is enough to keep the window accurate
  if (idleMs > TOUCH_AFTER_MINUTES * 60_000) {
    await supabase
      .from("clients")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", client.id);
  }

  return { state: "ok", client: shaped };
}
