import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";

export default async function ReservarPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;

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

  const [{ data: services }, { data: availability }, { data: settings }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, color, image_url, kind")
      .order("price"),
    supabase.from("availability").select("*").order("weekday"),
    supabase
      .from("booking_settings")
      .select("booking_window_days, min_notice_minutes")
      .eq("id", 1)
      .single(),
  ]);

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-foreground">Reservar cita</h1>
        <p className="text-sm text-muted">Elige tu servicio y horario</p>
      </header>

      <BookingFlow
        clientId={client.id}
        services={services ?? []}
        availability={availability ?? []}
        bookingWindowDays={settings?.booking_window_days ?? 30}
        minNoticeMinutes={settings?.min_notice_minutes ?? 60}
        preselectedServiceId={params.serviceId}
      />
    </div>
  );
}
