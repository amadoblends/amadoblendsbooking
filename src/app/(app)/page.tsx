import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronRight, Scissors, Clock, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get or create client record
  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  // Next upcoming appointment
  const { data: nextApt } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, services(name, color, duration_minutes)")
    .eq("client_id", client.id)
    .gte("starts_at", new Date().toISOString())
    .neq("status", "cancelada")
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Services
  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes, price, color, image_url")
    .order("price", { ascending: true })
    .limit(6);

  const firstName = client.full_name.split(" ")[0];

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">¡Bienvenido!</p>
          <h1 className="text-2xl font-bold text-foreground">{firstName} ✂️</h1>
        </div>
        <Link href="/perfil">
          <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
            <span className="text-sm font-bold text-brand">
              {client.full_name[0].toUpperCase()}
            </span>
          </div>
        </Link>
      </header>

      {/* Next appointment */}
      {nextApt ? (
        <Link
          href={`/citas/${nextApt.id}`}
          className="block bg-brand rounded-2xl p-5 text-white shadow-lg shadow-brand/20"
        >
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">
            Próxima cita
          </p>
          <p className="text-xl font-bold">
            {format(new Date(nextApt.starts_at), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <p className="text-white/90 text-sm mt-0.5">
            {new Date(nextApt.starts_at).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}{" "}
            · {(nextApt.services as unknown as { name: string }).name}
          </p>
          <div className="flex items-center gap-1 mt-3 text-white/80 text-xs">
            <Clock size={12} /> Ver detalle →
          </div>
        </Link>
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-5 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mx-auto">
            <Scissors size={24} className="text-brand" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Sin citas próximas</p>
            <p className="text-sm text-muted mt-0.5">¿Listo para tu próximo corte?</p>
          </div>
          <Link
            href="/reservar"
            className="inline-block bg-brand text-white text-sm font-semibold px-6 py-2.5 rounded-xl"
          >
            Reservar ahora
          </Link>
        </div>
      )}

      {/* Services */}
      {services && services.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Nuestros servicios</h2>
            <Link href="/reservar" className="text-sm text-brand font-semibold">
              Ver todos
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {services.map((s) => (
              <Link
                key={s.id}
                href={`/reservar?serviceId=${s.id}`}
                className="bg-surface rounded-2xl border border-border p-4 space-y-2 active:bg-background"
              >
                {s.image_url ? (
                  <div className="w-full h-24 rounded-xl overflow-hidden mb-2">
                    <Image
                      src={s.image_url}
                      alt={s.name}
                      width={200}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-full h-24 rounded-xl mb-2 flex items-center justify-center"
                    style={{ background: `${s.color}22` }}
                  >
                    <Scissors size={28} style={{ color: s.color }} />
                  </div>
                )}
                <p className="font-semibold text-sm text-foreground">{s.name}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">{s.duration_minutes} min</p>
                  <p className="text-sm font-bold text-brand">${s.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
          <Star size={18} className="text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Amado Blends Barbershop</p>
          <p className="text-xs text-muted">Cortes clásicos y modernos · Reservas online</p>
        </div>
        <ChevronRight size={16} className="text-muted shrink-0" />
      </div>
    </div>
  );
}
