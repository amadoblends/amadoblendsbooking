/**
 * Who generates and delivers the code.
 *
 * ── The seam ─────────────────────────────────────────────────────────────
 * This is the ONLY thing that changes when a real SMS service arrives.
 * Everything else — the challenge record, the expiry, the attempt limit, the
 * cooldown, the session that follows a correct code — is provider-agnostic
 * and stays exactly as it is.
 *
 * The interface is deliberately two methods. A provider generates a code and
 * sends it; it does not decide how long the code lives, how many guesses are
 * allowed, or what happens afterwards. Those are policy, they belong to the
 * app, and letting a provider own them is how you end up unable to change
 * providers.
 */

export interface OtpProvider {
  /** A name for logs and for the "sent via" line. */
  readonly id: string;
  /**
   * Produces the code to be stored (hashed) and sent.
   *
   * Separate from `send` so the code can be hashed and recorded *before*
   * anything leaves the building: a code that was delivered but not recorded
   * is a code nobody can redeem.
   */
  generate(): string;
  /**
   * Delivers it. Returning false means "not delivered" — the caller treats
   * that as a failed request rather than pretending it worked.
   */
  send(phone: string, code: string): Promise<boolean>;
  /** True when the code isn't really secret, so the UI can say so. */
  readonly isDevelopment: boolean;
}

/** How long a code is good for. */
export const CODE_TTL_SECONDS = 300;
/** Wrong guesses before the challenge is burned. */
export const MAX_ATTEMPTS = 5;
/** Seconds before another code can be requested. */
export const RESEND_COOLDOWN_SECONDS = 45;
/** Codes per hour per number, so requesting one can't run up a bill. */
export const MAX_PER_HOUR = 8;

/**
 * The stand-in used until an SMS account exists.
 *
 * Always 000000, sends nothing. It is not a security hole *yet* because
 * there is nothing real behind these accounts — but it is one the moment
 * there is, which is why `isDevelopment` is exposed and the app says so on
 * screen while it's in use.
 */
export const devProvider: OtpProvider = {
  id: "dev",
  isDevelopment: true,
  generate: () => "000000",
  send: async () => true,
};

/**
 * What Twilio will look like. Not wired up — there is no account yet — but
 * written out so the shape of the change is obvious: fill in three
 * environment variables, swap the export at the bottom of this file, and
 * nothing else in the app moves.
 *
 * ```ts
 * export const twilioProvider: OtpProvider = {
 *   id: "twilio",
 *   isDevelopment: false,
 *   generate: () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, "0"),
 *   async send(phone, code) {
 *     const sid = process.env.TWILIO_ACCOUNT_SID!;
 *     const res = await fetch(
 *       `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
 *       {
 *         method: "POST",
 *         headers: {
 *           Authorization: "Basic " + btoa(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`),
 *           "Content-Type": "application/x-www-form-urlencoded",
 *         },
 *         body: new URLSearchParams({
 *           To: phone,
 *           From: process.env.TWILIO_FROM_NUMBER!,
 *           Body: `Tu código de Amado Blends es ${code}. Caduca en 5 minutos.`,
 *         }),
 *       }
 *     );
 *     return res.ok;
 *   },
 * };
 * ```
 */

/**
 * The provider in use.
 *
 * Chosen by environment rather than hardcoded, so switching is a variable
 * and a deploy — and so a forgotten `TWILIO_ACCOUNT_SID` can't silently
 * leave production on the fixed code.
 */
export function getProvider(): OtpProvider {
  // When a real one is added, check its credentials here and return it
  return devProvider;
}
