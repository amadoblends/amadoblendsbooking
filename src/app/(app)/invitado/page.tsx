import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { GuestAdder } from "@/components/booking/guest-adder";

export default async function InvitadoPage() {
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

  const [{ data: upcoming }, { data: services }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, services(name)")
      .eq("client_id", client.id)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelada")
      .order("starts_at", { ascending: true })
      .limit(10),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("is_public", true)
      .order("price"),
  ]);

  const appointments = (upcoming ?? []).map((a) => ({
    id: a.id,
    starts_at: a.starts_at,
    serviceName: (a.services as unknown as { name: string }).name,
  }));

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Agregar invitado</h1>
          <p className="text-sm text-muted">Trae a un amigo a tu cita</p>
        </div>
      </header>

      {appointments.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center space-y-3">
          <UserPlus size={32} className="text-muted mx-auto" />
          <p className="text-sm text-muted">
            No tienes citas próximas. Reserva una cita primero para poder agregar un invitado.
          </p>
          <Link
            href="/reservar"
            className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            Reservar cita
          </Link>
        </div>
      ) : (
        <GuestAdder appointments={appointments} services={services ?? []} />
      )}
    </div>
  );
}
