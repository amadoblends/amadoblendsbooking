"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to Postgres changes on the given tables and refreshes the
 * current route when anything changes — no manual refresh needed.
 */
export function RealtimeRefresher({ tables }: { tables: string[] }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timeout: ReturnType<typeof setTimeout> | null = null;
    // Set when an event arrives while the app is in the background
    let missed = false;

    function refresh() {
      // Re-rendering a tab nobody is looking at costs a full server round trip
      // for nothing; remember it and catch up when they come back.
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

    const channel = supabase.channel(`rt-${tables.join("-")}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // Debounce bursts of events into a single refresh
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(refresh, 400);
      });
    }
    channel.subscribe();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), router]);

  return null;
}
