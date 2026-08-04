import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { GuestBookingFlow } from "@/components/booking/guest-booking-flow";

export default async function InvitadoPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, first_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const [{ data: services }, { data: availability }, { data: settings }] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, color, image_url, kind")
      .eq("is_public", true)
      .order("price"),
    supabase.from("availability").select("*").order("weekday"),
    supabase
      .from("booking_settings")
      .select("booking_window_days, min_notice_minutes")
      .eq("id", 1)
      .single(),
  ]);

  const ownerName = client.first_name ?? client.full_name.split(" ")[0];

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Agregar invitado</h1>
          <p className="text-sm text-muted">Reserva una cita para alguien más</p>
        </div>
      </header>

      <GuestBookingFlow
        clientId={client.id}
        ownerName={ownerName}
        services={services ?? []}
        availability={availability ?? []}
        bookingWindowDays={settings?.booking_window_days ?? 30}
        minNoticeMinutes={settings?.min_notice_minutes ?? 60}
      />
    </div>
  );
}
