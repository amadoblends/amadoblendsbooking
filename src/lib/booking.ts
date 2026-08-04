import { addMinutes, isBefore } from "date-fns";

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

/** Builds a local Date from a "yyyy-MM-dd" string plus minutes past midnight. */
export function slotToDate(dateStr: string, mins: number) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0);
}

export interface SlotOptions {
  /** Overrides the day's own step; how often times are offered. */
  intervalMinutes?: number;
  /** Extra minutes reserved after the service (cleanup/prep). */
  bufferMinutes?: number;
  /** Prefer times that butt against existing appointments. */
  optimizeGaps?: boolean;
}

/** Start times where a service of `durMins` fits: inside hours, outside the
 *  break, past the notice window and not overlapping anything busy. */
export function generateSlots(
  day: AvailDay,
  durMins: number,
  minNoticeMins: number,
  dateStr: string,
  busy: BusyInterval[],
  options: SlotOptions = {}
): string[] {
  if (!day.is_active) return [];

  const start = toMins(day.start_time);
  const end = toMins(day.end_time);
  const step = options.intervalMinutes ?? day.slot_minutes;
  const buffer = options.bufferMinutes ?? 0;
  const breakStart = day.break_start_time ? toMins(day.break_start_time) : null;
  const breakEnd = day.break_end_time ? toMins(day.break_end_time) : null;
  const notBefore = addMinutes(new Date(), minNoticeMins);

  // The full block the barber is occupied for, service plus buffer
  const blockMins = durMins + buffer;
  const candidates: { mins: number; touchesBooking: boolean }[] = [];

  for (let t = start; t + blockMins <= end; t += step) {
    if (breakStart !== null && breakEnd !== null && t < breakEnd && t + blockMins > breakStart) {
      continue;
    }
    const slotStart = slotToDate(dateStr, t);
    if (isBefore(slotStart, notBefore)) continue;

    const sMs = slotStart.getTime();
    const eMs = sMs + blockMins * 60000;
    if (busy.some((b) => sMs < b.end && eMs > b.start)) continue;

    // A slot "touches" a booking when it starts right as one ends, or ends
    // right as the next one starts — those leave no dead time behind.
    const touchesBooking = busy.some(
      (b) => Math.abs(b.end - sMs) < 60_000 || Math.abs(eMs - b.start) < 60_000
    );

    candidates.push({ mins: t, touchesBooking });
  }

  if (!options.optimizeGaps) return candidates.map((c) => fromMins(c.mins));

  // With optimization on, only offer gap-free times — unless that would
  // leave the client with nothing, in which case show everything.
  const tight = candidates.filter((c) => c.touchesBooking);
  const hasAnyBooking = busy.length > 0;
  const chosen = hasAnyBooking && tight.length > 0 ? tight : candidates;
  return chosen.map((c) => fromMins(c.mins));
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
