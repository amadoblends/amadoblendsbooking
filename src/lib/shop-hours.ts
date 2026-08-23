import { shopMins, shopToday, shopDateStr } from "@/lib/timezone";
import { minutesOf, isDayClosed, type ClosureLike } from "@/lib/availability-slots";

/**
 * Whether the shop is open right now, and when that changes.
 *
 * ── Why this isn't just start <= now <= end ──────────────────────────────
 * "Open" has to survive a holiday, a lunch break, and a day the barber
 * doesn't work — and it has to be answered in the shop's timezone, not the
 * phone's, or a client in another state is told the shop is shut when it
 * isn't. Every one of those is a real closure, and a header that says "Open"
 * during a vacation is worse than no header.
 */

export interface DayHours {
  weekday: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
}

export type ShopState =
  | { open: true; closesAt: string }
  | { open: false; reason: "break"; opensAt: string }
  | { open: false; reason: "closed-today" | "holiday" }
  | { open: false; reason: "before-open" | "after-close"; opensAt?: string };

/** "18:00" → "6:00 PM", the way a person reads a closing time. */
export function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

export function shopState(
  availability: DayHours[],
  closures: ClosureLike[] = [],
  now = Date.now()
): ShopState {
  const today = shopDateStr(new Date(now));

  if (isDayClosed(today, closures)) return { open: false, reason: "holiday" };

  /*
   * The weekday has to come from the shop's own date. Taking it from the
   * device would roll over at the wrong midnight for anyone in another
   * timezone — and at 8pm Puerto Rico that is already tomorrow in UTC.
   */
  const weekday = new Date(shopToday() + "T12:00:00Z").getUTCDay();
  const day = availability.find((d) => d.weekday === weekday);

  if (!day?.is_active) return { open: false, reason: "closed-today" };

  const mins = shopMins(new Date(now));
  const open = minutesOf(day.start_time);
  const close = minutesOf(day.end_time);

  if (mins < open) return { open: false, reason: "before-open", opensAt: day.start_time };
  if (mins >= close) return { open: false, reason: "after-close" };

  // Lunch reads as closed, because turning up during it means a locked door
  if (day.break_start_time && day.break_end_time) {
    const bStart = minutesOf(day.break_start_time);
    const bEnd = minutesOf(day.break_end_time);
    if (mins >= bStart && mins < bEnd) {
      return { open: false, reason: "break", opensAt: day.break_end_time };
    }
  }

  return { open: true, closesAt: day.end_time };
}

/** The one line the header shows. */
export function shopStateLabel(state: ShopState, lang: "es" | "en" = "es"): string {
  const es = lang === "es";
  if (state.open) {
    return es
      ? `Abierto · Cierra a las ${prettyTime(state.closesAt)}`
      : `Open · Closes at ${prettyTime(state.closesAt)}`;
  }
  switch (state.reason) {
    case "break":
      return es
        ? `En descanso · Vuelve a las ${prettyTime(state.opensAt)}`
        : `On break · Back at ${prettyTime(state.opensAt)}`;
    case "before-open":
      return es
        ? `Cerrado · Abre a las ${prettyTime(state.opensAt!)}`
        : `Closed · Opens at ${prettyTime(state.opensAt!)}`;
    case "holiday":
      return es ? "Cerrado hoy" : "Closed today";
    case "closed-today":
      return es ? "Cerrado hoy" : "Closed today";
    default:
      return es ? "Cerrado" : "Closed";
  }
}
