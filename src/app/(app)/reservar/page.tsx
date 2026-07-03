import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { BackButton } from "@/components/ui/back-button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";

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

  const [
    { data: services },
    { data: availability },
    { data: settings },
    { data: products },
    { data: promotions },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, color, image_url, kind, description")
      .eq("is_public", true)
      .order("price"),
    supabase.from("availability").select("*").order("weekday"),
    supabase
      .from("booking_settings")
      .select("booking_window_days, min_notice_minutes")
      .eq("id", 1)
      .single(),
    supabase
      .from("products")
      .select("id, name, price, image_url")
      .gt("stock", 0)
      .order("name"),
    supabase
      .from("promotions")
      .select("id, title, discount_percent, service_id, weekdays, start_time, end_time, ends_on")
      .eq("is_active", true),
  ]);

  // Names of the single services included in each combo (hidden singles too)
  const [{ data: packageItems }, { data: allServiceNames }] = await Promise.all([
    supabase.from("service_package_items").select("package_id, item_service_id"),
    supabase.from("services").select("id, name"),
  ]);

  const nameById = new Map((allServiceNames ?? []).map((s) => [s.id, s.name]));
  const includesByPackage = new Map<string, string[]>();
  for (const row of packageItems ?? []) {
    const itemName = nameById.get(row.item_service_id);
    if (!itemName) continue;
    const list = includesByPackage.get(row.package_id) ?? [];
    list.push(itemName);
    includesByPackage.set(row.package_id, list);
  }

  const servicesWithIncludes = (services ?? []).map((s) => ({
    ...s,
    included_names: s.kind === "package" ? (includesByPackage.get(s.id) ?? []) : [],
  }));

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4">
      <RealtimeRefresher tables={["services", "promotions", "products"]} />
      <header className="mb-5 flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Reservar cita</h1>
          <p className="text-sm text-muted">Elige tu servicio y horario</p>
        </div>
      </header>

      <BookingFlow
        clientId={client.id}
        services={servicesWithIncludes}
        products={products ?? []}
        availability={availability ?? []}
        promotions={promotions ?? []}
        bookingWindowDays={settings?.booking_window_days ?? 30}
        minNoticeMinutes={settings?.min_notice_minutes ?? 60}
        preselectedServiceId={params.serviceId}
      />
    </div>
  );
}
