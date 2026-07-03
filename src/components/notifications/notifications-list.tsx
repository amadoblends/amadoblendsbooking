"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, BadgePercent, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string;
  read: boolean;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

function iconFor(type: string) {
  if (type === "cita") return CalendarClock;
  if (type === "promo") return BadgePercent;
  return Bell;
}

export function NotificationsList({
  notifications,
  clientId,
}: {
  notifications: Notification[];
  clientId: string;
}) {
  const router = useRouter();

  // Mark all as read on open + subscribe to new ones in realtime
  useEffect(() => {
    const supabase = createClient();
    const unread = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unread.length > 0) {
      supabase
        .from("client_notifications")
        .update({ read: true })
        .in("id", unread)
        .then(() => {});
    }

    const channel = supabase
      .channel("notif-client")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_notifications",
          filter: `client_id=eq.${clientId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div className="space-y-2">
      {notifications.map((n) => {
        const Icon = iconFor(n.type);
        return (
          <div
            key={n.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4",
              n.read ? "bg-surface border-border" : "bg-brand-light border-brand/30"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                n.read ? "bg-background" : "bg-brand/15"
              )}
            >
              <Icon size={18} className={n.read ? "text-muted" : "text-brand"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-foreground">{n.title}</p>
                <span className="text-[10px] text-muted shrink-0">{timeAgo(n.created_at)}</span>
              </div>
              {n.body && <p className="text-xs text-muted mt-0.5">{n.body}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
