/**
 * Turning what someone types into one canonical number.
 *
 * ── Why this matters more than it looks ──────────────────────────────────
 * The same person types 787-555-0000, (787) 555 0000 and +1 787 555 0000 on
 * different days. If those are three different keys, they get three accounts
 * — and the code sent for one lets nobody into the others. Every comparison
 * in the app has to go through here.
 *
 * It matches `normalize_phone` in the database (migration 29) on purpose:
 * the last ten digits. Puerto Rico and the US share +1, so ten digits is the
 * whole number and the country code is noise.
 */

/** Digits only, last ten. Null when there aren't ten. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** "7875550000" → "(787) 555-0000", for showing back. */
export function formatPhone(normalized: string): string {
  if (normalized.length !== 10) return normalized;
  return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}

/**
 * "(•••) •••-0000" — enough to recognise your own number, not enough to
 * learn someone else's from a screen someone else is holding.
 */
export function maskPhone(normalized: string): string {
  if (normalized.length !== 10) return "•••";
  return `(•••) •••-${normalized.slice(6)}`;
}

/** E.164, which is what an SMS API wants. */
export function toE164(normalized: string): string {
  return `+1${normalized}`;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}
