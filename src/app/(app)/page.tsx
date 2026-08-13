import { createClient } from "@/lib/supabase/server";
import { Clock, Scissors } from "lucide-react";
// Times must read the same here as on the barber's calendar — see lib/timezone
import { shopTime, shopShortDate } from "@/lib/timezone";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { QuickAccessGrid } from "@/components/home/quick-access-grid";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { BusinessHeader } from "@/components/home/business-header";
import { getBusiness } from "@/lib/data/business";
import { getT } from "@/lib/session";

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

  const [business, { data: nextApt }, { data: services }, { data: carouselPosts }] =
    await Promise.all([
      getBusiness(),
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
    /*
     * RLS keeps drafts, paused and finished posts out (migration 23), but the
     * window fields come along so the carousel can re-check the clock while
     * the app stays open — expiry is a clock event, not a database change.
     */
    supabase
      .from("carousel_posts")
      .select(
        "id, title, description, image_url, type, button_label, button_href, is_active, is_draft, is_permanent, starts_at, ends_at"
      )
      .order("sort_order"),
    ]);

  const firstName = client.full_name.split(" ")[0];
  const { t, lang } = await getT();

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-5">
      <RealtimeRefresher
        tables={["services", "appointments", "carousel_posts", "business_settings"]}
      />

      {/* The shop's own identity leads the screen */}
      <BusinessHeader business={business}>
        <NotificationBell clientId={client.id} />
      </BusinessHeader>

      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-foreground">
          {t("home.greeting")}, {firstName}! 👋
        </h2>
        <p className="text-sm text-muted mt-0.5">{t("home.subtitle")}</p>
      </div>

      {/* Promotions, closures and announcements managed from the admin panel */}
      <HeroCarousel posts={carouselPosts ?? []} lang={lang} />

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
              {t("home.nextAppointment")}
            </p>
            <p className="text-sm font-semibold text-foreground capitalize truncate">
              {shopShortDate(nextApt.starts_at)} · {shopTime(nextApt.starts_at)} ·{" "}
              {(nextApt.services as unknown as { name: string }).name}
            </p>
          </div>
        </Link>
      )}

      {/* Quick access — long-press to reorder like iPhone apps */}
      <QuickAccessGrid />

      {/* Popular services */}
      {services && services.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground">{t("home.popularServices")}</h2>
            <Link href="/reservar" className="text-sm text-brand font-semibold">
              {t("home.seeAll")}
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
