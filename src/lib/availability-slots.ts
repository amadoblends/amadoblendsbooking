import { shopDateAt, shopDateStr, shopMins } from "@/lib/timezone";

/**
 * The one answer to "what times can actually be booked".
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * Four screens used to work this out independently — the barber's new
 * appointment, the barber's reschedule, the client's booking, the client's
 * reschedule — and they disagreed. The barber's reschedule was the worst of
 * them: it ignored the buffer, ignored the minimum notice, ignored closures,
 * ignored a product's extra minutes, and offered times that had already
 * passed. So a slot could be tapped and only then rejected.
 *
 * The rule this module enforces is the one worth stating plainly: if a time
 * appears on screen, it can be booked. Everything that could invalidate it is
 * applied here, once, and every caller gets the same answer.
 */

/** One weekday's working hours, as configured in Disponibilidad. */
export interface DayHours {
  is_active: boolean;
  /** "09:00:00" or "09:00" — both accepted. */
  start_time: string;
  end_time: string;
  /** How far apart offered start times are. */
  slot_minutes: number;
  break_start_time: string | null;
  break_end_time: string | null;
}

/** Anything already occupying the calendar, in epoch milliseconds. */
export interface BusyInterval {
  start: number;
  end: number;
}

/** A closure or holiday, whole-day or partial. */
export interface ClosureLike {
  starts_on: string;
  ends_on: string;
  all_day: boolean;
  /** Only meaningful when all_day is false. */
  start_time: string | null;
  end_time: string | null;
}

export interface SlotRules {
  /** Breathing room kept on both sides of every appointment. */
  bufferMinutes: number;
  /** How far ahead of now a booking has to be made. */
  minNoticeMinutes: number;
  /** Overrides the day's own step; how often times are offered. */
  intervalMinutes?: number;
  /**
   * Prefer times that butt against an existing appointment, so the day
   * doesn't fill with unusable ten-minute gaps. Falls back to offering
   * everything rather than leaving the client with nothing.
   *
   * Only meaningful with no buffer: a buffer exists precisely to stop
   * appointments touching, so the two can't both apply.
   */
  optimizeGaps?: boolean;
}

export const DEFAULT_RULES: SlotRules = { bufferMinutes: 0, minNoticeMinutes: 0 };

export interface SlotQuery {
  /** The day being offered, "YYYY-MM-DD". */
  dateStr: string;
  /** That weekday's hours; null or inactive means the shop is shut. */
  day: DayHours | null;
  /**
   * The *whole* visit in minutes — base service plus any product or add-on
   * that lengthens it. A slot is only offered if all of it fits.
   */
  durationMinutes: number;
  busy: BusyInterval[];
  closures?: ClosureLike[];
  rules?: SlotRules;
  /** Overridable so the logic can be tested against a fixed instant. */
  now?: number;
  /**
   * The appointment being rescheduled. It can't collide with itself, so its
   * own interval is dropped from `busy`.
   */
  ignore?: BusyInterval | null;
}

/** "09:00:00" and "09:00" both mean 540. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 540 → "09:00", the shape a time input and the database both want. */
export function hhmmOf(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** The closure covering a day, if any. */
export function closureOn(dateStr: string, closures: ClosureLike[]): ClosureLike | null {
  return closures.find((c) => dateStr >= c.starts_on && dateStr <= c.ends_on) ?? null;
}

/** True when the whole day is shut and nothing can be offered on it. */
export function isDayClosed(dateStr: string, closures: ClosureLike[]): boolean {
  const c = closureOn(dateStr, closures);
  return Boolean(c?.all_day);
}

/**
 * Every start time on this day that the whole visit genuinely fits into.
 *
 * A candidate has to clear all of these, in this order — cheapest test first,
 * so a closed day costs nothing:
 *
 *   1. the weekday is worked at all
 *   2. the day isn't inside an all-day closure
 *   3. the visit ends before closing time
 *   4. it doesn't run into the break
 *   5. it doesn't fall inside a partial closure
 *   6. it isn't in the past, counting the minimum notice
 *   7. it doesn't touch anything booked or blocked, buffer included
 */
export function availableSlots(q: SlotQuery): string[] {
  const {
    dateStr,
    day,
    durationMinutes,
    busy,
    closures = [],
    rules = DEFAULT_RULES,
    now = Date.now(),
    ignore = null,
  } = q;

  if (!day || !day.is_active) return [];
  if (durationMinutes <= 0) return [];
  if (isDayClosed(dateStr, closures)) return [];

  const open = minutesOf(day.start_time);
  const close = minutesOf(day.end_time);
  const step =
    rules.intervalMinutes && rules.intervalMinutes > 0
      ? rules.intervalMinutes
      : day.slot_minutes > 0
        ? day.slot_minutes
        : 15;

  const breakStart = day.break_start_time ? minutesOf(day.break_start_time) : null;
  const breakEnd = day.break_end_time ? minutesOf(day.break_end_time) : null;

  // A partial closure behaves like a second break for that day only
  const partial = closureOn(dateStr, closures);
  const closedStart =
    partial && !partial.all_day && partial.start_time ? minutesOf(partial.start_time) : null;
  const closedEnd =
    partial && !partial.all_day && partial.end_time ? minutesOf(partial.end_time) : null;

  const bufferMs = Math.max(0, rules.bufferMinutes) * 60_000;
  // Anything starting before this instant is already too late to book
  const earliestMs = now + Math.max(0, rules.minNoticeMinutes) * 60_000;

  // The appointment being moved doesn't block its own new time
  const occupied = ignore
    ? busy.filter((b) => !(b.start === ignore.start && b.end === ignore.end))
    : busy;

  // Kept with a note on whether it sits flush against existing work, for
  // optimizeGaps below
  const found: { time: string; flush: boolean }[] = [];

  for (let t = open; t + durationMinutes <= close; t += step) {
    const endMins = t + durationMinutes;

    // Overlapping the break at any point disqualifies the whole visit
    if (breakStart !== null && breakEnd !== null && t < breakEnd && endMins > breakStart) {
      continue;
    }
    if (closedStart !== null && closedEnd !== null && t < closedEnd && endMins > closedStart) {
      continue;
    }

    // Built in the shop's timezone, never the device's
    const startMs = shopDateAt(dateStr, hhmmOf(t)).getTime();
    if (startMs < earliestMs) continue;

    const finishMs = startMs + durationMinutes * 60_000;

    /*
     * The buffer pads the candidate rather than the stored rows, so it
     * applies on both sides without having to widen anything in the database.
     */
    const collides = occupied.some(
      (b) => startMs - bufferMs < b.end && finishMs + bufferMs > b.start
    );
    if (collides) continue;

    // Starts as one ends, or ends as the next begins — no dead time either way
    const flush = occupied.some(
      (b) => Math.abs(b.end - startMs) < 60_000 || Math.abs(finishMs - b.start) < 60_000
    );

    found.push({ time: hhmmOf(t), flush });
  }

  if (!rules.optimizeGaps || occupied.length === 0) {
    return found.map((f) => f.time);
  }

  // Offering only the tight times is pointless if it offers nothing
  const tight = found.filter((f) => f.flush);
  return (tight.length > 0 ? tight : found).map((f) => f.time);
}

/**
 * Whether one specific time is bookable — the same rules, asked about a
 * single candidate. Used when a time arrives from somewhere other than the
 * list: a drag, a deep link, a form that was left open.
 */
export function slotIsFree(q: SlotQuery & { time: string }): boolean {
  const wanted = minutesOf(q.time);
  /*
   * Checked against the grid rather than recomputing, so a dragged card can
   * never land somewhere the list would have refused. A drop between two
   * offered times is still validated, because the grid is generated from the
   * same step the drag snaps to.
   */
  return availableSlots(q).includes(hhmmOf(wanted));
}

/**
 * The next bookable day at or after `from`, or null within `limitDays`.
 * Lets a screen open on a day that has something to offer instead of on an
 * empty one the client then has to navigate away from.
 */
export function firstOpenDay(
  from: string,
  limitDays: number,
  dayFor: (dateStr: string) => DayHours | null,
  closures: ClosureLike[] = []
): string | null {
  for (let i = 0; i <= limitDays; i++) {
    const d = new Date(shopDateAt(from, "12:00").getTime() + i * 86_400_000);
    const key = shopDateStr(d);
    const day = dayFor(key);
    if (day?.is_active && !isDayClosed(key, closures)) return key;
  }
  return null;
}

/** Minutes since midnight for an instant, in the shop's timezone. */
export { shopMins as minutesInShopDay };
