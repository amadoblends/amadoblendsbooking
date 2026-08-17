"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** How often to re-check when the live socket can't be established. */
const FALLBACK_POLL_MS = 25_000;

/**
 * Refreshes the current route when the given tables change.
 *
 * ── Why this is more than channel().subscribe() ──────────────────────────
 * Realtime `postgres_changes` is filtered by RLS, which means the socket has
 * to carry the user's JWT. The browser client loads its session from cookies
 * *asynchronously*, so subscribing immediately after createClient() can open
 * the socket before the token is attached. The subscription then reads as
 * anonymous, RLS rejects it on an admin-only table like `appointments`, and no
 * event ever arrives — which looked exactly like "the barber's app only
 * updates when I touch something".
 *
 * So the token is set first, refreshed when it rotates, and if the socket
 * still can't be established the component falls back to a quiet poll. The
 * calendar updates on its own either way.
 */
export function RealtimeRefresher({ tables }: { tables: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    // Set when a change arrives while the app is in the background
    let missed = false;

    function refresh() {
      // Re-rendering a tab nobody is looking at costs a server round trip for
      // nothing; remember it and catch up when they come back.
      if (document.visibilityState !== "visible") {
        missed = true;
        return;
      }
      router.refresh();
    }

    function onVisible() {
      if (document.visibilityState === "visible" && missed) {
        missed = false;
        router.refresh();
      }
    }

    /** Debounce bursts — one booking touches several tables at once. */
    function schedule() {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(refresh, 400);
    }

    function startPolling() {
      if (poll) return;
      poll = setInterval(() => {
        if (document.visibilityState === "visible") router.refresh();
      }, FALLBACK_POLL_MS);
    }

    const channel = supabase.channel(`rt-${tables.join("-")}-${Math.random().toString(36).slice(2, 8)}`);

    (async () => {
      // The token has to be on the socket before it opens, or every
      // postgres_changes subscription is evaluated as anonymous.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);

      for (const table of tables) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
      }

      channel.subscribe((status) => {
        // TIMED_OUT and CHANNEL_ERROR mean we'd otherwise go silent
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          startPolling();
        } else if (status === "SUBSCRIBED" && poll) {
          clearInterval(poll);
          poll = null;
        }
      });
    })();

    // Tokens expire roughly hourly; without this the socket goes quiet after
    // the first rotation and nothing says why.
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token);
    });

    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (poll) clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      authSub.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), router]);

  return null;
}
