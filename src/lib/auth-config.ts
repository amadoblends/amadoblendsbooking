/**
 * Registering without waiting for a code.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The six-digit code can't be delivered yet: Supabase only sends one if the
 * email template contains {{ .Token }}, the template can't be edited without
 * custom SMTP, and SMTP needs a verified domain. Until that chain is
 * complete the registration screen asks for a code that never arrives.
 *
 * With this on, registration signs the person straight in — no code, no
 * email, no waiting. It exists so the rest of the app can be tested while
 * the email side is unfinished.
 *
 * ── What it costs ────────────────────────────────────────────────────────
 * Nobody proves they own the address they typed. Someone can register as
 * anyone, and password recovery would then send a reset to a stranger's
 * inbox. That is fine for a test database and unacceptable for real clients.
 *
 * So it is off unless explicitly switched on, the app says so on screen
 * while it's on, and the flag is read here and nowhere else — one place to
 * check before going live.
 */

/**
 * True only when NEXT_PUBLIC_AUTH_SKIP_OTP is exactly "true".
 *
 * Compared strictly on purpose: "false", "0" and "no" are all truthy
 * strings, and a flag that turns itself on when set to "false" is worse than
 * no flag.
 */
export const SKIP_OTP = process.env.NEXT_PUBLIC_AUTH_SKIP_OTP === "true";

/**
 * Shown while the flag is on, so it can't be quietly left on in production.
 * Deliberately not dismissible.
 */
export const SKIP_OTP_NOTICE = {
  es: "Modo de pruebas: el correo no se verifica.",
  en: "Test mode: email is not verified.",
} as const;
