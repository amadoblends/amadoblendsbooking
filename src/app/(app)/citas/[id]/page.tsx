import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, Calendar, Clock, Scissors, DollarSign, ShoppingBag, Users } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { CancelButton } from "@/components/booking/cancel-button";
import { RescheduleClient } from "@/components/booking/reschedule-client";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";

export default async function CitaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const [{ data: apt }, { data: aptProducts }, { data: guests }, { data: availability }, { data: settings }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, price, notes, services(name, color, duration_minutes)"
        )
        .eq("id", id)
        .eq("client_id", client.id)
        .maybeSingle(),
      supabase
        .from("appointment_products")
        .select("id, quantity, products(name, price, image_url)")
        .eq("appointment_id", id),
      supabase
        .from("appointment_guests")
        .select("id, full_name, phone, services(name)")
        .eq("appointment_id", id),
      supabase.from("availability").select("*").order("weekday"),
      supabase.from("booking_settings").select("booking_window_days").eq("id", 1).single(),
    ]);

  if (!apt) notFound();

  const svc = apt.services as unknown as { name: string; color: string; duration_minutes: number };
  const startsAt = new Date(apt.starts_at);
  const canModify =
    apt.status !== "cancelada" && apt.status !== "completada" && startsAt > new Date();

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-6 space-y-5">
      <RealtimeRefresher tables={["appointments"]} />
      <header className="flex items-center gap-3">
        <Link
          href="/citas"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Detalle de cita</h1>
      </header>

      {/* Status banner */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ background: `${svc.color}15`, borderLeft: `4px solid ${svc.color}` }}
      >
        <div className="flex-1">
          <p className="font-bold text-foreground text-lg">{svc.name}</p>
          <p className="text-sm text-muted">{svc.duration_minutes} minutos</p>
        </div>
        <StatusBadge status={apt.status} />
      </div>

      {/* Details card */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
        <DetailRow icon={<Calendar size={16} className="text-muted" />} label="Fecha">
          <span className="capitalize">
            {format(startsAt, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </span>
        </DetailRow>
        <DetailRow icon={<Clock size={16} className="text-muted" />} label="Hora">
          {startsAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </DetailRow>
        <DetailRow icon={<Scissors size={16} className="text-muted" />} label="Servicio">
          {svc.name}
        </DetailRow>
        <DetailRow icon={<DollarSign size={16} className="text-muted" />} label="Precio">
          ${Number(apt.price).toFixed(2)}
        </DetailRow>
      </div>

      {apt.notes && (
        <div className="bg-surface rounded-2xl border border-border p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Notas</p>
          <p className="text-sm text-foreground">{apt.notes}</p>
        </div>
      )}

      {/* Requested products */}
      {aptProducts && aptProducts.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag size={15} className="text-brand" />
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">
              Productos para tu visita
            </p>
          </div>
          {aptProducts.map((ap) => {
            const product = ap.products as unknown as { name: string; price: number };
            return (
              <div key={ap.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">
                  {ap.quantity}× {product.name}
                </span>
                <span className="text-muted">
                  ${(Number(product.price) * ap.quantity).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Guests */}
      {guests && guests.length > 0 && (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Users size={15} className="text-brand" />
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Invitados</p>
          </div>
          {guests.map((g) => {
            const gs = g.services as unknown as { name: string } | null;
            return (
              <div key={g.id} className="flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <p className="text-foreground font-medium truncate">{g.full_name}</p>
                  {gs && <p className="text-xs text-muted">✂️ {gs.name}</p>}
                </div>
                <span className="text-muted shrink-0">{g.phone}</span>
              </div>
            );
          })}
        </div>
      )}

      {canModify && (
        <RescheduleClient
          appointmentId={apt.id}
          currentStartsAt={apt.starts_at}
          currentEndsAt={apt.ends_at}
          durationMinutes={svc.duration_minutes}
          availability={availability ?? []}
          bookingWindowDays={settings?.booking_window_days ?? 30}
        />
      )}

      {canModify && <CancelButton appointmentId={apt.id} />}

      <Link
        href="/reservar"
        className="block w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm text-center leading-[48px]"
      >
        Reservar otra cita
      </Link>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm text-muted w-20 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground">{children}</span>
    </div>
  );
}
