/**
 * The single source of truth for turning a stored timestamp into text.
 *
 * ── The bug this exists to kill ──────────────────────────────────────────
 * Timestamps are stored correctly in UTC. The problem was *reading* them:
 * `new Date(iso).toLocaleTimeString()` formats in whatever timezone the code
 * happens to be running in. In a client component that's the phone (right);
 * in a server component on Vercel that's UTC (wrong by four hours). A 9:00 AM
 * appointment rendered as 1:00 PM on every server-rendered screen.
 *
 * Every function here names the shop's timezone explicitly, so it returns the
 * same string whether it runs on the server, in the browser, or in a job that
 * sends an email at 3am. Never call toLocaleTimeString / date-fns format on a
 * raw timestamp again — go through this module.
 *
 * Moving the shop means changing NEXT_PUBLIC_SHOP_TIMEZONE in both Vercel
 * projects. Nothing else.
 */

export const SHOP_TZ =
  process.env.NEXT_PUBLIC_SHOP_TIMEZONE?.trim() || "America/Puerto_Rico";

function asDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Cached formatters — building an Intl.DateTimeFormat is not cheap. */
const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: SHOP_TZ });
    cache.set(key, f);
  }
  return f;
}

/**
 * "9:00 AM" in the shop's timezone.
 *
 * Spanish locales render the meridiem as "a. m." / "p. m."; normalised to the
 * uppercase form the rest of the app uses so a time reads identically in an
 * email and on the calendar.
 */
export function shopTime(value: string | Date, locale = "es-PR"): string {
  return fmt(locale, { hour: "numeric", minute: "2-digit" })
    .format(asDate(value))
    .replace(/\s*a\.\s*m\.?/i, " AM")
    .replace(/\s*p\.\s*m\.?/i, " PM")
    .replace(/\s+/g, " ")
    .trim();
}

/** "9:00 AM – 9:45 AM" */
export function shopTimeRange(
  start: string | Date,
  end: string | Date,
  locale = "es-PR"
): string {
  return `${shopTime(start, locale)} – ${shopTime(end, locale)}`;
}

/** Arbitrary date formatting, always in the shop's timezone. */
export function shopFormat(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions,
  locale = "es-PR"
): string {
  return fmt(locale, opts).format(asDate(value));
}

/** "jueves, 6 de agosto de 2026" */
export function shopLongDate(value: string | Date, locale = "es-PR"): string {
  return shopFormat(
    value,
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    locale
  );
}

/** "jue 6 ago" */
export function shopShortDate(value: string | Date, locale = "es-PR"): string {
  return shopFormat(value, { weekday: "short", day: "numeric", month: "short" }, locale);
}

/**
 * The calendar day a timestamp falls on, as yyyy-MM-dd in the shop's
 * timezone. This is what day-bucketing must use — grouping by the server's
 * UTC day pushes evening appointments onto the next date.
 */
export function shopDateStr(value: string | Date): string {
  // en-CA gives ISO-ordered parts, so no manual reassembly is needed
  return fmt("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(
    asDate(value)
  );
}

/** Minutes since midnight in the shop's timezone. */
export function shopMins(value: string | Date): number {
  const parts = fmt("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(asDate(value));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Today in the shop's timezone, as yyyy-MM-dd. */
export function shopToday(): string {
  return shopDateStr(new Date());
}

/**
 * The UTC instant for a wall-clock time in the shop.
 *
 * Writing appointments used to build a Date from the *server's* local
 * timezone, which stored the wrong instant whenever the two disagreed. This
 * works out the shop's real offset for that date — so it stays correct across
 * daylight-saving changes in timezones that observe them.
 */
export function shopDateAt(dateStr: string, hhmm: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);

  // Start from the naive UTC reading, then correct by the zone's offset there
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const offset = tzOffsetMs(new Date(naive));
  // Re-check once: near a DST boundary the first guess can land on the wrong side
  const corrected = naive + offset;
  const settled = naive + tzOffsetMs(new Date(corrected));
  return new Date(settled);
}

/**
 * Midnight at the *start of the following day*, in the shop's timezone.
 *
 * "Stops showing on 6 August" means visible through all of the 6th. Taking
 * the next day's midnight rather than adding 24 hours keeps that true across
 * a daylight-saving change, where a day can be 23 or 25 hours long.
 */
export function endOfShopDay(dateStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  // Date.UTC rolls month and year over for us on the last day of a month
  const next = new Date(Date.UTC(y, mo - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return shopDateAt(nextStr, "00:00");
}

/** How far behind UTC the shop is, in ms, at a given instant. */
function tzOffsetMs(at: Date): number {
  const parts = fmt("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return at.getTime() - asUTC;
}
