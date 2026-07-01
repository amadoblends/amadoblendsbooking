import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function MisCitasPage() {
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

  const { data: upcoming } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, price, services(name, color, duration_minutes)")
    .eq("client_id", client.id)
    .gte("starts_at", new Date().toISOString())
    .neq("status", "cancelada")
    .order("starts_at", { ascending: true });

  const { data: past } = await supabase
    .from("appointments")
    .select("id, starts_at, status, price, services(name, color)")
    .eq("client_id", client.id)
    .lt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(20);

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <header>
        <h1 className="text-xl font-bold text-foreground">Mis citas</h1>
      </header>

      {/* Upcoming */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Próximas</h2>
        {!upcoming || upcoming.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-6 text-center space-y-3">
            <Calendar size={32} className="text-muted mx-auto" />
            <p className="text-sm text-muted">No tienes citas próximas.</p>
            <Link
              href="/reservar"
              className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              Reservar ahora
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => {
              const svc = a.services as unknown as { name: string; color: string; duration_minutes: number };
              return (
                <Link
                  key={a.id}
                  href={`/citas/${a.id}`}
                  className="flex items-center gap-3 bg-surface rounded-2xl border border-border p-4 active:bg-background"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${svc.color}22` }}
                  >
                    <Clock size={20} style={{ color: svc.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{svc.name}</p>
                    <p className="text-sm text-muted capitalize">
                      {format(new Date(a.starts_at), "EEEE d MMM", { locale: es })} ·{" "}
                      {new Date(a.starts_at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Past */}
      {past && past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">Historial</h2>
          <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
            {past.map((a) => {
              const svc = a.services as unknown as { name: string; color: string };
              return (
                <Link
                  key={a.id}
                  href={`/citas/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-background"
                >
                  <div
                    className="w-2 self-stretch rounded-full shrink-0"
                    style={{ background: svc.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{svc.name}</p>
                    <p className="text-xs text-muted capitalize">
                      {format(new Date(a.starts_at), "d MMM yyyy", { locale: es })}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
