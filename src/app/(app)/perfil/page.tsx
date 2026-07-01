import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChevronRight, LogOut, Calendar, Scissors } from "lucide-react";
import Link from "next/link";
import { SignOutButton } from "@/components/profile/sign-out-button";

export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, phone, email, avatar_url, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const { count: totalApts } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("client_id", client.id)
    .neq("status", "cancelada");

  const initials = client.full_name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <header>
        <h1 className="text-xl font-bold text-foreground">Mi perfil</h1>
      </header>

      {/* Avatar + name */}
      <div className="bg-surface rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-brand">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-lg">{client.full_name}</p>
          <p className="text-sm text-muted truncate">{client.email ?? user.email}</p>
          <p className="text-sm text-muted">{client.phone}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-2xl border border-border p-4 text-center">
          <Calendar size={20} className="text-brand mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{totalApts ?? 0}</p>
          <p className="text-xs text-muted">Citas realizadas</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-4 text-center">
          <Scissors size={20} className="text-brand mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">Amado</p>
          <p className="text-xs text-muted">Tu barbero</p>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        <Link
          href="/citas"
          className="flex items-center gap-3 px-4 py-3.5 active:bg-background"
        >
          <Calendar size={18} className="text-muted shrink-0" />
          <span className="flex-1 text-sm font-medium text-foreground">Mis citas</span>
          <ChevronRight size={16} className="text-muted" />
        </Link>
        <Link
          href="/reservar"
          className="flex items-center gap-3 px-4 py-3.5 active:bg-background"
        >
          <Scissors size={18} className="text-muted shrink-0" />
          <span className="flex-1 text-sm font-medium text-foreground">Reservar cita</span>
          <ChevronRight size={16} className="text-muted" />
        </Link>
      </div>

      <SignOutButton />
    </div>
  );
}
