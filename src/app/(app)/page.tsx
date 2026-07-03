import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, CalendarPlus, Clock, Scissors, ShoppingBag, UserPlus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

const quickAccess = [
  { href: "/reservar", label: "Reservar cita", icon: CalendarPlus },
  { href: "/citas", label: "Mis citas", icon: Clock },
  { href: "/invitado", label: "Agregar invitado", icon: UserPlus },
  { href: "/tienda", label: "Productos", icon: ShoppingBag },
];

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const [{ data: nextApt }, { data: services }] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, status, services(name)")
      .eq("client_id", client.id)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelada")
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, duration_minutes, price, color, image_url")
      .eq("kind", "single")
      .eq("is_public", true)
      .order("price", { ascending: true })
      .limit(4),
  ]);

  const firstName = client.full_name.split(" ")[0];

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
            <span className="text-white font-black text-lg leading-none">A</span>
          </div>
          <span className="font-bold tracking-[0.18em] text-sm text-foreground">
            AMADOBLENDS
          </span>
        </div>
        <Link
          href="/citas"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
        >
          <Bell size={17} className="text-muted" />
        </Link>
      </header>

      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">¡Hola, {firstName}! 👋</h1>
        <p className="text-sm text-muted mt-0.5">¿Listo para tu próximo corte?</p>
      </div>

      {/* Hero banner — drop /public/images/hero.jpg to replace the gradient */}
      <Link
        href="/reservar"
        className="block relative overflow-hidden rounded-3xl border border-border"
        style={{
          backgroundImage:
            "linear-gradient(100deg, rgba(11,11,13,0.95) 5%, rgba(11,11,13,0.6) 50%, rgba(255,106,61,0.35) 130%), url('/images/hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center right",
        }}
      >
        <div className="p-6 pr-28 min-h-[168px] flex flex-col justify-center">
          <p className="text-[26px] leading-[1.1] font-black text-foreground uppercase">
            Tu mejor
            <br />
            versión
          </p>
          <p className="text-[26px] leading-[1.1] font-black text-brand uppercase">
            comienza aquí
          </p>
          <span className="mt-4 inline-flex self-start bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-xl">
            Reservar cita
          </span>
        </div>
        <Scissors
          size={90}
          className="absolute -right-3 top-1/2 -translate-y-1/2 text-brand/15 rotate-[-20deg]"
        />
      </Link>

      {/* Next appointment strip */}
      {nextApt && (
        <Link
          href={`/citas/${nextApt.id}`}
          className="flex items-center gap-3 bg-surface rounded-2xl border border-border p-4 active:bg-background"
        >
          <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
            <Clock size={19} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-brand uppercase tracking-wide">
              Próxima cita
            </p>
            <p className="text-sm font-semibold text-foreground capitalize truncate">
              {format(new Date(nextApt.starts_at), "EEE d MMM", { locale: es })} ·{" "}
              {new Date(nextApt.starts_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · {(nextApt.services as unknown as { name: string }).name}
            </p>
          </div>
        </Link>
      )}

      {/* Quick access */}
      <div className="grid grid-cols-4 gap-3">
        {quickAccess.map((item) => (
          <Link key={item.href} href={item.href} className="flex flex-col items-center gap-2">
            <div className="w-full aspect-square max-w-[72px] rounded-2xl bg-surface border border-border flex items-center justify-center active:bg-brand-light">
              <item.icon size={22} className="text-brand" />
            </div>
            <span className="text-[10px] font-medium text-muted text-center leading-tight">
              {item.label}
            </span>
          </Link>
        ))}
      </div>

      {/* Popular services */}
      {services && services.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">Servicios populares</h2>
            <Link href="/reservar" className="text-sm text-brand font-semibold">
              Ver todos
            </Link>
          </div>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {services.map((s) => (
              <Link
                key={s.id}
                href={`/reservar?serviceId=${s.id}`}
                className="flex items-center gap-3 bg-surface rounded-2xl border border-border p-3 active:bg-background"
              >
                {s.image_url ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                    <Image
                      src={s.image_url}
                      alt={s.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
                    style={{ background: `${s.color}26` }}
                  >
                    <Scissors size={20} style={{ color: s.color }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">{s.duration_minutes} min</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-bold text-foreground">${s.price}</p>
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
                    <span className="text-white font-bold text-base leading-none">+</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
