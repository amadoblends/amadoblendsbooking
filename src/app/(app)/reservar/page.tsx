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
      .eq("is_visible_for_sale", true)
      .order("name"),
    supabase
      .from("promotions")
      .select("id, title, discount_percent, service_id, weekdays, start_time, end_time, ends_on")
      .eq("is_active", true),
  ]);

  // Combo contents + the products each service offers during the visit
  const [{ data: packageItems }, { data: allServiceNames }, { data: serviceProducts }] =
    await Promise.all([
      supabase.from("service_package_items").select("package_id, item_service_id"),
      supabase.from("services").select("id, name"),
      supabase
        .from("service_products")
        .select("service_id, products(id, name, image_url, category, available_for_services)"),
    ]);

  const serviceProductsByService = new Map<
    string,
    { id: string; name: string; image_url: string | null; category: "dry" | "wet" | null }[]
  >();
  for (const row of serviceProducts ?? []) {
    const product = row.products as unknown as {
      id: string;
      name: string;
      image_url: string | null;
      category: "dry" | "wet" | null;
      available_for_services: boolean;
    } | null;
    if (!product || !product.available_for_services) continue;
    const list = serviceProductsByService.get(row.service_id) ?? [];
    list.push({
      id: product.id,
      name: product.name,
      image_url: product.image_url,
      category: product.category,
    });
    serviceProductsByService.set(row.service_id, list);
  }

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
    service_products: serviceProductsByService.get(s.id) ?? [],
  }));

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4">
      <RealtimeRefresher tables={["services", "promotions", "products", "service_products"]} />
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
