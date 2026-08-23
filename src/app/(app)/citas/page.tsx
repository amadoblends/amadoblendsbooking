import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { BookingsView, type BookingItem } from "@/components/appointments/bookings-view";
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

  const { t, lang } = await getT();
  const nowISO = new Date().toISOString();

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, price, guest_name, guest_relationship, services(name, image_url)"
      )
      .eq("client_id", client.id)
      .gte("starts_at", nowISO)
      .neq("status", "cancelada")
      .order("starts_at", { ascending: true }),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, status, price, guest_name, guest_relationship, services(name, image_url)"
      )
      .eq("client_id", client.id)
      .lt("starts_at", nowISO)
      .order("starts_at", { ascending: false })
      // A year of visits is more than anyone scrolls; the rest isn't fetched
      .limit(60),
  ]);

  type Row = {
    id: string;
    starts_at: string;
    status: string;
    price: number;
    guest_name: string | null;
    guest_relationship: string | null;
    services: unknown;
  };

  const shape = (rows: Row[] | null): BookingItem[] =>
    (rows ?? []).map((a) => {
      const svc = (Array.isArray(a.services) ? a.services[0] : a.services) as
        | { name: string; image_url: string | null }
        | null;
      return {
        id: a.id,
        starts_at: a.starts_at,
        status: a.status,
        price: Number(a.price),
        service_name: svc?.name ?? t("booking.service"),
        service_image: svc?.image_url ?? null,
        guest_label: a.guest_name
          ? `${a.guest_name}${
              a.guest_relationship
                ? ` · ${relationshipLabel(a.guest_relationship, lang)}`
                : ""
            }`
          : null,
      };
    });

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-5">
      <RealtimeRefresher tables={["appointments"]} />

      {/* Centred title, as on the rest of the tabbed screens */}
      <h1 className="text-[17px] font-bold text-foreground text-center">
        {t("appointments.title")}
      </h1>

      <BookingsView upcoming={shape(upcoming as Row[] | null)} past={shape(past as Row[] | null)} />
    </div>
  );
}
