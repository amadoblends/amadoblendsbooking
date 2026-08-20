import { addMinutes, isBefore } from "date-fns";
import { shopDateAt } from "@/lib/timezone";
import { availableSlots, type ClosureLike } from "@/lib/availability-slots";

export interface AvailDay {
  weekday: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_minutes: number;
}

export interface BusyInterval {
  start: number; // epoch ms
  end: number;
}

export const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function fromMins(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function fmtSlot(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}

/**
 * The instant matching a slot's wall-clock time **at the shop**.
 *
 * This used to be `new Date(y, m, d, h, mi)`, which reads the *client's*
 * device timezone — so the same 9:00 AM slot stored a different instant for a
 * client booking from another state than for one booking in the shop.
 */
export function slotToDate(dateStr: string, mins: number) {
  return shopDateAt(dateStr, fromMins(mins));
}

export interface SlotOptions {
  /** Overrides the day's own step; how often times are offered. */
  intervalMinutes?: number;
  /** Breathing room kept on both sides of every appointment. */
  bufferMinutes?: number;
  /** Prefer times that butt against existing appointments. */
  optimizeGaps?: boolean;
  /** Vacations and holidays, so a shut day offers nothing. */
  closures?: ClosureLike[];
}

/**
 * Start times where the whole visit fits.
 *
 * Now a thin wrapper over lib/availability-slots, which is the single rule
 * shared with the barber's calendar. The signature is unchanged so callers
 * didn't have to move; what changed is that closures are honoured and the
 * buffer is applied on both sides of the candidate rather than only after it,
 * which is what a buffer is for.
 */
export function generateSlots(
  day: AvailDay,
  durMins: number,
  minNoticeMins: number,
  dateStr: string,
  busy: BusyInterval[],
  options: SlotOptions = {}
): string[] {
  return availableSlots({
    dateStr,
    day,
    durationMinutes: durMins,
    busy,
    closures: options.closures ?? [],
    rules: {
      bufferMinutes: options.bufferMinutes ?? 0,
      minNoticeMinutes: minNoticeMins,
      intervalMinutes: options.intervalMinutes,
      optimizeGaps: options.optimizeGaps,
    },
  });
}

export const GUEST_RELATIONSHIPS = [
  { value: "friend", es: "Amigo", en: "Friend" },
  { value: "family", es: "Familiar", en: "Family" },
  { value: "brother", es: "Hermano", en: "Brother" },
  { value: "sister", es: "Hermana", en: "Sister" },
  { value: "son", es: "Hijo", en: "Son" },
  { value: "daughter", es: "Hija", en: "Daughter" },
  { value: "parent", es: "Padre/Madre", en: "Parent" },
  { value: "partner", es: "Pareja", en: "Partner" },
  { value: "other", es: "Otro", en: "Other" },
] as const;

export type GuestRelationship = (typeof GUEST_RELATIONSHIPS)[number]["value"];

export function relationshipLabel(value: string | null, lang: "es" | "en" = "es") {
  const found = GUEST_RELATIONSHIPS.find((r) => r.value === value);
  return found ? found[lang] : value ?? "";
}
