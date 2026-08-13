import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Calendar, Clock, UserPlus } from "lucide-react";
// Times must read the same here as on the barber's calendar — see lib/timezone
import { shopTime, shopShortDate } from "@/lib/timezone";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { BackButton } from "@/components/ui/back-button";
import { GroupedHistory, type HistoryAppointment } from "@/components/appointments/grouped-history";
import { relationshipLabel } from "@/lib/booking";
import { getT } from "@/lib/session";

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

  const { t } = await getT();
  const nowISO = new Date().toISOString();

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, price, guest_name, guest_relationship, services(name, color, duration_minutes)"
      )
      .eq("client_id", client.id)
      .gte("starts_at", nowISO)
      .neq("status", "cancelada")
      .order("starts_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, starts_at, status, price, guest_name, guest_relationship, services(name, color)")
      .eq("client_id", client.id)
      .lt("starts_at", nowISO)
      .order("starts_at", { ascending: false })
      .limit(400),
  ]);

  const history: HistoryAppointment[] = (past ?? []).map((a) => {
    const svc = a.services as unknown as { name: string; color: string } | null;
    return {
      id: a.id,
      starts_at: a.starts_at,
      status: a.status,
      price: Number(a.price),
      serviceName: svc?.name ?? "Servicio",
      serviceColor: svc?.color ?? "#999999",
      guestName: a.guest_name,
      guestRelationship: a.guest_relationship,
    };
  });

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <RealtimeRefresher tables={["appointments"]} />
      <header className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-foreground">{t("appointments.title")}</h1>
      </header>

      {/* Upcoming */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          {t("appointments.upcoming")}
        </h2>
        {!upcoming || upcoming.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-6 text-center space-y-3">
            <Calendar size={32} className="text-muted mx-auto" />
            <p className="text-sm text-muted">{t("appointments.none")}</p>
            <Link
              href="/reservar"
              className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              {t("appointments.bookNow")}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => {
              const svc = a.services as unknown as {
                name: string;
                color: string;
                duration_minutes: number;
              };
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
                      {shopShortDate(a.starts_at)} · {shopTime(a.starts_at)}
                    </p>
                    {a.guest_name && (
                      <p className="text-xs text-brand font-semibold flex items-center gap-1 mt-0.5">
                        <UserPlus size={10} />
                        {a.guest_name} ({relationshipLabel(a.guest_relationship)})
                      </p>
                    )}
                  </div>
                  <StatusBadge status={a.status} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* History grouped by year → month → day */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          {t("appointments.history")}
        </h2>
        <GroupedHistory appointments={history} />
      </section>
    </div>
  );
}
