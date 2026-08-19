import { shopToday } from "@/lib/timezone";

/**
 * Rules about a client that both apps have to agree on: whether they still
 * count as new, whether it's their birthday, and what the birthday discount
 * comes to.
 *
 * Pure and server-free, so the barber's panel and the client's app can't
 * drift apart on what any of it means.
 */

export interface BirthdaySettings {
  birthday_enabled: boolean;
  /** 'percent' takes a share off; 'fixed' takes an amount off. */
  birthday_kind: "percent" | "fixed";
  birthday_amount: number;
  /** Days either side of the date on which it still applies. */
  birthday_window_days: number;
  /** Empty means every service. */
  birthday_service_ids: string[];
}

export const DEFAULT_BIRTHDAY: BirthdaySettings = {
  birthday_enabled: false,
  birthday_kind: "percent",
  birthday_amount: 15,
  birthday_window_days: 7,
  birthday_service_ids: [],
};

/** "MM-DD" — the part of a birth date that repeats every year. */
function monthDay(iso: string): string {
  return iso.slice(5, 10);
}

/**
 * Days between a birthday and a given date, ignoring the year.
 *
 * Wraps around new year, so 30 December and 2 January are three days apart
 * rather than three hundred and sixty-two.
 */
export function daysFromBirthday(dateOfBirth: string, onDate = shopToday()): number {
  const [bm, bd] = monthDay(dateOfBirth).split("-").map(Number);
  const [ty, tm, td] = onDate.split("-").map(Number);

  // Compare inside a single year, then also against the neighbouring ones
  const target = Date.UTC(2000, tm - 1, td);
  const candidates = [
    Date.UTC(2000, bm - 1, bd),
    Date.UTC(1999, bm - 1, bd),
    Date.UTC(2001, bm - 1, bd),
  ];
  void ty;

  return Math.min(
    ...candidates.map((c) => Math.round(Math.abs(target - c) / 86_400_000))
  );
}

/** Their birthday is today. */
export function isBirthdayToday(dateOfBirth: string | null | undefined, onDate = shopToday()): boolean {
  if (!dateOfBirth) return false;
  return monthDay(dateOfBirth) === onDate.slice(5, 10);
}

/** Inside the window where the birthday discount still applies. */
export function isInBirthdayWindow(
  dateOfBirth: string | null | undefined,
  settings: BirthdaySettings,
  onDate = shopToday()
): boolean {
  if (!dateOfBirth || !settings.birthday_enabled) return false;
  return daysFromBirthday(dateOfBirth, onDate) <= settings.birthday_window_days;
}

/**
 * What the birthday takes off a given service, in currency.
 *
 * Returns 0 whenever it doesn't apply — disabled, outside the window, or a
 * service the barber didn't include. Never returns more than the price.
 */
export function birthdayDiscount(
  price: number,
  serviceId: string,
  dateOfBirth: string | null | undefined,
  settings: BirthdaySettings,
  onDate = shopToday()
): number {
  if (!isInBirthdayWindow(dateOfBirth, settings, onDate)) return 0;

  const limited = settings.birthday_service_ids.length > 0;
  if (limited && !settings.birthday_service_ids.includes(serviceId)) return 0;

  const off =
    settings.birthday_kind === "percent"
      ? price * (settings.birthday_amount / 100)
      : settings.birthday_amount;

  // Never turn a discount into a refund
  return Math.max(0, Math.min(price, Number(off.toFixed(2))));
}

export interface NewClientSettings {
  new_client_days: number;
  new_client_visits: number;
}

export const DEFAULT_NEW_CLIENT: NewClientSettings = {
  new_client_days: 60,
  new_client_visits: 3,
};

/**
 * Whether the "nuevo" badge still applies.
 *
 * It used to be a stored segment that nothing ever cleared, so a client from
 * a year ago still read as new. Deriving it means it expires on its own, by
 * time *and* by visits — whichever happens first.
 */
export function isNewClient(
  createdAt: string,
  visitCount: number,
  settings: NewClientSettings = DEFAULT_NEW_CLIENT
): boolean {
  if (visitCount >= settings.new_client_visits) return false;
  const ageDays = (Date.now() - Date.parse(createdAt)) / 86_400_000;
  return ageDays <= settings.new_client_days;
}
