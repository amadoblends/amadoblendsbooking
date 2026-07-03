"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell({ clientId }: { clientId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { count: c } = await supabase
        .from("client_notifications")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("read", false);
      setCount(c ?? 0);
    }
    load();

    const channel = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_notifications",
          filter: `client_id=eq.${clientId}`,
        },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  return (
    <Link
      href="/notificaciones"
      className="relative w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
    >
      <Bell size={17} className="text-muted" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
