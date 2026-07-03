import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Bell } from "lucide-react";
import { NotificationsList } from "@/components/notifications/notifications-list";

export default async function NotificacionesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const { data: notifications } = await supabase
    .from("client_notifications")
    .select("id, title, body, type, read, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Notificaciones</h1>
      </header>

      {!notifications || notifications.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-10 text-center space-y-2">
          <Bell size={28} className="text-muted mx-auto" />
          <p className="text-sm text-muted">No tienes notificaciones aún.</p>
        </div>
      ) : (
        <NotificationsList notifications={notifications} clientId={client.id} />
      )}
    </div>
  );
}
