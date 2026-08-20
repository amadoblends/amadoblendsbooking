import { createClient } from "@/lib/supabase/server";
import { Cake, Clock, Scissors } from "lucide-react";
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
import { getCarouselPosts } from "@/lib/data/carousel";
import { getT } from "@/lib/session";
import { isBirthdayToday, isInBirthdayWindow } from "@/lib/client-rules";
import { getBirthdaySettings } from "@/lib/data/birthday";
import { CompleteBirthDate } from "@/components/profile/complete-birth-date";
import { RateVisit, type AwaitingVisit } from "@/components/feedback/rate-visit";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, birth_date")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const [business, { data: nextApt }, { data: services }, carouselPosts, birthday] =
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
    // Degrades gracefully when migration 23 has not run — see lib/data/carousel
    getCarouselPosts(),
    getBirthdaySettings(),
    ]);

  const firstName = client.full_name.split(" ")[0];
  const { t, lang } = await getT();

  /*
   * The last finished visit they haven't rated. Asked here because it's the
   * screen they open anyway, a day or two after the haircut — the feedback
   * screen in the profile is where a rating goes to never be given.
   * Degrades to nothing before migration 36.
   */
  const { data: awaiting } = await supabase.rpc("visit_awaiting_rating");
  const awaitingVisit = (Array.isArray(awaiting) ? awaiting[0] : awaiting) as
    | AwaitingVisit
    | undefined;

  const isBirthday = isBirthdayToday(client.birth_date);
  // The gift banner runs the whole window; the greeting only on the day
  const hasGift = isInBirthdayWindow(client.birth_date, birthday);

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
          {isBirthday ? t("birthday.happy") : t("home.greeting")}, {firstName}!{" "}
          {isBirthday ? "🎂" : "👋"}
        </h2>
        <p className="text-sm text-muted mt-0.5">
          {isBirthday ? t("birthday.gift") : t("home.subtitle")}
        </p>
      </div>

      {/* The discount is real, so it says so where they'll book from */}
      {hasGift && (
        <Link
          href="/reservar"
          className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-light p-4 active:scale-[0.99] transition-transform"
        >
          <span className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center shrink-0">
            <Cake size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">
              {birthday.birthday_kind === "percent"
                ? `${birthday.birthday_amount}% ${t("booking.discount").toLowerCase()}`
                : `$${birthday.birthday_amount} ${t("booking.discount").toLowerCase()}`}
            </span>
            <span className="block text-xs text-muted">
              {isBirthday ? t("birthday.gift") : t("birthday.soon")}
            </span>
          </span>
        </Link>
      )}

      {/*
        * Registration requires a birth date now; clients who signed up before
        * it did are asked here rather than being locked out of their own app.
        */}
      {!client.birth_date && <CompleteBirthDate clientId={client.id} />}

      {awaitingVisit && <RateVisit visit={awaitingVisit} clientId={client.id} />}

      {/* Promotions, closures and announcements managed from the admin panel */}
      <HeroCarousel posts={carouselPosts} lang={lang} />

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
