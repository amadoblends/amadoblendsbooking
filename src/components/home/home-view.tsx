"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, Calendar, ShoppingBag, UserPlus, MapPin, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";
import { SectionHeader } from "@/components/shop/category-rail";

export interface HomeService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
}

export interface HomeOffer {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

/**
 * The four things worth one tap from the home screen.
 *
 * Gift cards are not among them — nothing sells them yet, and a tile that
 * opens nothing is worse than a gap. Booking for someone else is a real
 * thing clients do here, so that's what takes the fourth place.
 */
const QUICK = [
  { href: "/reservar", icon: CalendarPlus, key: "nav.book" as const },
  { href: "/citas", icon: Calendar, key: "nav.myBookings" as const },
  { href: "/tienda", icon: ShoppingBag, key: "nav.shop" as const },
  { href: "/invitado", icon: UserPlus, key: "guest.add" as const },
];

export function HomeView({
  businessName,
  stateLabel,
  isOpen,
  coverUrl,
  services,
  offers,
}: {
  businessName: string;
  stateLabel: string;
  isOpen: boolean;
  coverUrl: string | null;
  services: HomeService[];
  offers: HomeOffer[];
}) {
  const { t } = useT();

  return (
    <div className="space-y-6">
      {/* Where, and whether it's worth walking over right now */}
      <div className="flex items-start gap-2">
        <MapPin size={15} className="text-brand shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground leading-tight">
            {businessName}
          </p>
          <p className="text-[12px] leading-tight mt-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                isOpen ? "bg-success" : "bg-muted"
              )}
            />
            <span className={isOpen ? "text-success font-medium" : "text-muted"}>
              {stateLabel}
            </span>
          </p>
        </div>
      </div>

      {/*
        * The hero. A photograph with the words over it, not a coloured panel:
        * the shop's own room is a better advert than any gradient, and it's
        * the only place in the app where type sits on an image.
        */}
      <Link
        href="/reservar"
        className="relative block w-full overflow-hidden rounded-[var(--radius-card)] active:scale-[0.99] transition-transform"
        style={{ aspectRatio: "16 / 10" }}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 560px"
            className="object-cover"
            priority
          />
        ) : (
          <span className="absolute inset-0 bg-foreground" />
        )}
        {/* Dark from the left so the words stay readable whatever the photo */}
        <span className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />

        <span className="absolute inset-0 p-5 flex flex-col justify-center">
          <span className="font-display text-[26px] leading-[1.1] text-white block">
            {t("home.heroTitle1")}
            <br />
            {t("home.heroTitle2")}
          </span>
          <span className="text-[12px] text-white/75 mt-1.5 block max-w-[62%]">
            {t("home.heroSub")}
          </span>
          <span className="mt-3.5 inline-flex self-start items-center h-9 px-4 rounded-[var(--radius-control)] bg-brand text-[var(--color-brand-on)] text-xs font-bold">
            {t("home.bookNow")}
          </span>
        </span>
      </Link>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2.5">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="bg-surface rounded-[var(--radius-card)] border border-border py-3 px-1 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
          >
            <q.icon size={19} className="text-foreground" strokeWidth={1.8} />
            <span className="text-[10px] font-semibold text-foreground text-center leading-tight line-clamp-2">
              {t(q.key)}
            </span>
          </Link>
        ))}
      </div>

      {/* Popular services — a rail, so the row hints there is more sideways */}
      {services.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title={t("home.popularServices")} action={{ label: t("home.seeAll"), href: "/reservar" }} />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
            {services.map((s, i) => (
              <Link
                key={s.id}
                href={`/reservar?service=${s.id}`}
                className="shrink-0 w-[132px] active:scale-[0.98] transition-transform"
              >
                <div
                  className="relative w-full overflow-hidden rounded-[var(--radius-card)] bg-surface-tint"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  {s.image_url ? (
                    <Image
                      src={s.image_url}
                      alt={s.name}
                      fill
                      sizes="132px"
                      className="object-cover"
                      priority={i === 0}
                      loading={i === 0 ? undefined : "lazy"}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-muted">
                      <Scissors size={22} />
                    </span>
                  )}
                </div>
                <p className="text-[13px] font-semibold text-foreground leading-snug mt-2 line-clamp-2">
                  {s.name}
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  {s.duration_minutes} min
                </p>
                <p className="text-[13px] font-bold text-foreground mt-0.5 tnum">
                  ${Number(s.price).toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Whatever the barber is running this week */}
      {offers.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title={t("home.specialOffers")} />
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
            {offers.map((o) => (
              <Link
                key={o.id}
                href="/reservar"
                className="shrink-0 w-[86%] max-w-[320px] relative overflow-hidden rounded-[var(--radius-card)] bg-surface-tint active:scale-[0.99] transition-transform"
                style={{ aspectRatio: "16 / 7" }}
              >
                {o.image_url && (
                  <Image
                    src={o.image_url}
                    alt=""
                    fill
                    sizes="320px"
                    className="object-cover"
                    loading="lazy"
                  />
                )}
                <span className="absolute inset-0 p-4 flex flex-col justify-center">
                  <span className="text-[19px] font-extrabold text-foreground leading-tight max-w-[70%]">
                    {o.title}
                  </span>
                  {o.description && (
                    <span className="text-[12px] text-muted mt-0.5 max-w-[65%] line-clamp-2">
                      {o.description}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
