import { createClient } from "@/lib/supabase/server";
import { Cake, Clock, Scissors } from "lucide-react";
// Times must read the same here as on the barber's calendar — see lib/timezone
import { shopTime, shopShortDate } from "@/lib/timezone";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { getBusiness } from "@/lib/data/business";
import { getCarouselPosts } from "@/lib/data/carousel";
import { getT } from "@/lib/session";
import { isBirthdayToday, isInBirthdayWindow } from "@/lib/client-rules";
import { getBirthdaySettings } from "@/lib/data/birthday";
import { CompleteBirthDate } from "@/components/profile/complete-birth-date";
import { RateVisit, type AwaitingVisit } from "@/components/feedback/rate-visit";
import { HomeView } from "@/components/home/home-view";
import { shopState, shopStateLabel } from "@/lib/shop-hours";

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

  const [
    business,
    { data: nextApt },
    { data: services },
    carouselPosts,
    birthday,
    { data: availability },
    { data: closures },
  ] = await Promise.all([
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
    // Opening hours and holidays, for the "Open · Closes at" line
    supabase.from("availability").select("*").order("weekday"),
    supabase
      .from("closures")
      .select("starts_on, ends_on, all_day, start_time, end_time")
      .gte("ends_on", new Date().toISOString().slice(0, 10)),
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

  const state = shopState(availability ?? [], closures ?? []);
  const stateLabel = shopStateLabel(state, lang);

  const isBirthday = isBirthdayToday(client.birth_date);
  // The gift banner runs the whole window; the greeting only on the day
  const hasGift = isInBirthdayWindow(client.birth_date, birthday);

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-5">
      <RealtimeRefresher
        tables={["services", "appointments", "carousel_posts", "business_settings"]}
      />

      {/*
        * The shop's name in the serif, and the bell. Nothing else — the
        * design opens with the name, and a second heading under it competes
        * with the hero for the same job.
        */}
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[26px] text-foreground leading-none">
          {business.name}
        </h1>
        <NotificationBell clientId={client.id} />
      </header>

      {/*
        * The greeting rides under the name, small. On a birthday it's the
        * one day it earns its own line.
        */}
      <p className="text-[13px] text-[var(--color-foreground-soft)] -mt-2">
        {isBirthday ? `${t("birthday.happy")}, ${firstName}! 🎂` : `${t("home.greeting")}, ${firstName}`}
      </p>

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
          className="flex items-center gap-3 bg-surface rounded-[var(--radius-card)] border border-border p-4 active:bg-background"
        >
          <div className="w-11 h-11 rounded-[var(--radius-control)] bg-brand-light flex items-center justify-center shrink-0">
            <Clock size={19} className="text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-brand uppercase tracking-wide">
              {t("home.nextAppointment")}
            </p>
            <p className="text-[13px] font-semibold text-foreground capitalize truncate mt-0.5">
              {shopShortDate(nextApt.starts_at)} · {shopTime(nextApt.starts_at)} ·{" "}
              {(nextApt.services as unknown as { name: string }).name}
            </p>
          </div>
        </Link>
      )}

      {/*
        * Location, hero, quick actions, services and offers — see HomeView.
        * The quick-access grid it replaces was four tiles the client could
        * reorder; the order is fixed now because the four are the whole app,
        * and reordering four things is a setting nobody asked for.
        */}
      <HomeView
        businessName={business.name}
        stateLabel={stateLabel}
        isOpen={state.open}
        coverUrl={business.cover_url}
        services={(services ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: Number(s.price),
          image_url: s.image_url,
        }))}
        offers={[]}
      />
    </div>
  );
}
