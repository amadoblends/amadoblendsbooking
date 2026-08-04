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

/** Start times where a service of `durMins` fits: inside hours, outside the
 *  break, past the notice window and not overlapping anything busy. */
export function generateSlots(
  day: AvailDay,
  durMins: number,
  minNoticeMins: number,
  dateStr: string,
  busy: BusyInterval[]
): string[] {
  if (!day.is_active) return [];
  const start = toMins(day.start_time);
  const end = toMins(day.end_time);
  const step = day.slot_minutes;
  const breakStart = day.break_start_time ? toMins(day.break_start_time) : null;
  const breakEnd = day.break_end_time ? toMins(day.break_end_time) : null;
  const notBefore = addMinutes(new Date(), minNoticeMins);
  const out: string[] = [];

  for (let t = start; t + durMins <= end; t += step) {
    if (breakStart !== null && breakEnd !== null && t < breakEnd && t + durMins > breakStart) {
      continue;
    }
    const slotStart = slotToDate(dateStr, t);
    if (isBefore(slotStart, notBefore)) continue;

    const sMs = slotStart.getTime();
    const eMs = sMs + durMins * 60000;
    if (busy.some((b) => sMs < b.end && eMs > b.start)) continue;

    out.push(fromMins(t));
  }
  return out;
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
