"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarClock, ChevronRight, Scissors, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { shopTime, shopLongDate } from "@/lib/timezone";
import { StatusBadge } from "@/components/ui/status-badge";
import { useT } from "@/components/i18n/language-provider";

export interface BookingItem {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  service_name: string;
  service_image: string | null;
  guest_label: string | null;
}

/**
 * Mis reservas: what's coming, and what already happened.
 *
 * ── Why the first one is bigger ──────────────────────────────────────────
 * The next appointment is the only row anyone opens this screen for. It gets
 * the photograph, the full date, and its two actions inline — reschedule and
 * cancel are the reason to be here, and burying them one tap deeper is the
 * difference between changing a booking and not bothering.
 *
 * Everything after it is a row: image, name, when, status, chevron. The list
 * is for orientation, not for acting on.
 */
export function BookingsView({
  upcoming,
  past,
}: {
  upcoming: BookingItem[];
  past: BookingItem[];
}) {
  const { t } = useT();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const [next, ...rest] = upcoming;
  const shown = tab === "upcoming" ? rest : past;

  return (
    <div className="space-y-5">
      {/* Underline tabs, not a filled pill: this is a view switch, not a choice */}
      <div className="flex border-b border-border">
        {(["upcoming", "past"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex-1 pb-2.5 text-[13px] font-bold transition-colors relative",
              tab === k ? "text-brand" : "text-muted"
            )}
          >
            {k === "upcoming" ? t("appointments.upcoming") : t("appointments.history")}
            {tab === k && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === "upcoming" && next && (
        <section className="space-y-2.5">
          <p className="text-[11px] font-bold text-muted uppercase tracking-wide">
            {t("appointments.nextOne")}
          </p>

          <div className="bg-surface rounded-[var(--radius-card)] border border-border overflow-hidden">
            <div className="p-3.5 flex gap-3.5">
              <div
                className="relative w-[92px] shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-tint"
                style={{ aspectRatio: "1 / 1" }}
              >
                {next.service_image ? (
                  <Image
                    src={next.service_image}
                    alt=""
                    fill
                    sizes="92px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-muted">
                    <Scissors size={20} />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-[15px] font-bold text-foreground leading-snug line-clamp-1">
                  {next.service_name}
                </p>
                {next.guest_label && (
                  <p className="text-[11px] text-muted mt-0.5">{next.guest_label}</p>
                )}
                <p className="text-[12px] text-muted capitalize mt-1.5">
                  {shopLongDate(next.starts_at)}
                </p>
                <p className="text-[15px] font-bold text-foreground tnum">
                  {shopTime(next.starts_at)}
                </p>
                <span className="mt-1.5 self-start">
                  <StatusBadge status={next.status} />
                </span>
              </div>
            </div>

            {/* The two things worth doing, where they can be reached */}
            <div className="grid grid-cols-2 border-t border-border divide-x divide-border">
              <Link
                href={`/citas/${next.id}?action=reschedule`}
                className="h-11 flex items-center justify-center gap-1.5 text-[12px] font-bold text-foreground active:bg-background"
              >
                <CalendarClock size={14} /> {t("appointments.rescheduleShort")}
              </Link>
              <Link
                href={`/citas/${next.id}?action=cancel`}
                className="h-11 flex items-center justify-center gap-1.5 text-[12px] font-bold text-danger active:bg-background"
              >
                <X size={14} /> {t("common.cancel")}
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-2.5">
        {tab === "upcoming" && rest.length > 0 && (
          <p className="text-[11px] font-bold text-muted uppercase tracking-wide">
            {t("appointments.more")}
          </p>
        )}

        {shown.length === 0 ? (
          <div className="text-center py-14 space-y-3">
            <Scissors size={28} className="text-muted mx-auto" />
            <p className="text-sm text-muted">
              {tab === "upcoming" && !next
                ? t("appointments.none")
                : tab === "past"
                  ? t("appointments.noHistory")
                  : t("appointments.noMore")}
            </p>
            {tab === "upcoming" && !next && (
              <Link
                href="/reservar"
                className="inline-flex items-center h-11 px-5 rounded-[var(--radius-control)] bg-brand text-[var(--color-brand-on)] text-xs font-bold"
              >
                {t("appointments.bookNow")}
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {shown.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/citas/${b.id}`}
                  className="flex items-center gap-3 bg-surface rounded-[var(--radius-card)] border border-border p-3 active:bg-background"
                >
                  <div
                    className="relative w-[52px] shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-tint"
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    {b.service_image ? (
                      <Image
                        src={b.service_image}
                        alt=""
                        fill
                        sizes="52px"
                        className="object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-muted">
                        <Scissors size={16} />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground line-clamp-1">
                      {b.service_name}
                    </p>
                    <p className="text-[11px] text-muted capitalize mt-0.5">
                      {shopLongDate(b.starts_at)}
                    </p>
                    <p className="text-[12px] font-bold text-foreground tnum">
                      {shopTime(b.starts_at)}
                    </p>
                    <span className="mt-1 inline-block">
                      <StatusBadge status={b.status} />
                    </span>
                  </div>

                  <ChevronRight size={16} className="text-muted shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
