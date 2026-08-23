"use server";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePhone, toE164 } from "@/lib/otp/phone";
import {
  getProvider,
  CODE_TTL_SECONDS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  MAX_PER_HOUR,
} from "@/lib/otp/provider";

/**
 * Phone sign-in: request a code, then redeem it.
 *
 * ── How this survives swapping in real SMS ───────────────────────────────
 * Only `getProvider()` knows what a code is or how it travels. Everything
 * here — hashing it, expiring it, counting attempts, the cooldown, minting
 * the session — is the same whether the code came from a constant or from
 * Twilio. Changing provider changes one file.
 *
 * ── Why the code is hashed ───────────────────────────────────────────────
 * It's 000000 today, so hashing looks like theatre. It isn't: the table
 * outlives the shim, and a table of readable codes is a table that hands
 * over any account to whoever can read it. Doing it now means there's no
 * migration to remember later.
 */

export interface OtpResult {
  ok: boolean;
  error?: string;
  /** True while the code is a fixed constant, so the UI can say so. */
  development?: boolean;
  /** Seconds until another code may be requested. */
  retryIn?: number;
}

function hashCode(phone: string, code: string): string {
  // Salted with the phone, so identical codes for different numbers don't
  // produce identical hashes
  return createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

/** Compared in constant time, so a wrong guess can't be timed character by character. */
function codeMatches(stored: string, candidate: string): boolean {
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(candidate, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const NOT_CONFIGURED =
  "Falta SUPABASE_SERVICE_ROLE_KEY. El acceso por teléfono no puede funcionar sin ella.";

/**
 * Sends a code to a number.
 *
 * Records it before sending: a code that went out but wasn't stored is a
 * code nobody can redeem, which looks to the person like the app is broken.
 */
export async function requestPhoneCode(rawPhone: string): Promise<OtpResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Escribe un número de 10 dígitos." };

  const db = createServiceClient();
  if (!db) return { ok: false, error: NOT_CONFIGURED };

  // Cooldown: the most recent challenge for this number
  const { data: recent } = await db
    .from("otp_challenges")
    .select("created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = (Date.now() - Date.parse(recent.created_at)) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        error: "Espera un momento antes de pedir otro código.",
        retryIn: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }

  /*
   * A ceiling per number per hour. Without it, "send code" is a button that
   * sends SMS at the shop's expense — free today, real money with Twilio.
   */
  const { data: count } = await db.rpc("otp_recent_count", { p_phone: phone, p_minutes: 60 });
  if (typeof count === "number" && count >= MAX_PER_HOUR) {
    return { ok: false, error: "Demasiados códigos. Inténtalo dentro de una hora." };
  }

  const provider = getProvider();
  const code = provider.generate();

  const { error: insertError } = await db.from("otp_challenges").insert({
    phone,
    code_hash: hashCode(phone, code),
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
  });

  if (insertError) {
    return { ok: false, error: "No se pudo generar el código. Inténtalo de nuevo." };
  }

  const sent = await provider.send(toE164(phone), code);
  if (!sent) return { ok: false, error: "No se pudo enviar el código." };

  return { ok: true, development: provider.isDevelopment };
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
  /** True when this phone had no account and one was just created. */
  isNew?: boolean;
}

/**
 * Redeems a code and signs the person in.
 *
 * The session is minted with the service key: the account is keyed by phone
 * and has no password the person knows, so there is nothing to sign in
 * *with* until they set one. A fresh random password is written and used
 * immediately, and it never leaves the server.
 */
export async function verifyPhoneCode(
  rawPhone: string,
  code: string
): Promise<VerifyResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { ok: false, error: "Número inválido." };
  if (!/^\d{6}$/.test(code.trim())) return { ok: false, error: "El código son 6 dígitos." };

  const db = createServiceClient();
  if (!db) return { ok: false, error: NOT_CONFIGURED };

  const { data: challenge } = await db
    .from("otp_challenges")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challenge) return { ok: false, error: "Pide un código primero." };
  if (challenge.consumed_at) return { ok: false, error: "Ese código ya se usó. Pide uno nuevo." };
  if (Date.parse(challenge.expires_at) < Date.now()) {
    return { ok: false, error: "Ese código expiró. Pide uno nuevo." };
  }
  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Demasiados intentos. Pide un código nuevo." };
  }

  if (!codeMatches(challenge.code_hash, hashCode(phone, code.trim()))) {
    // Counted before answering, so guessing costs the guesser something
    await db
      .from("otp_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("id", challenge.id);
    return { ok: false, error: "Código incorrecto." };
  }

  // Correct — burn it before doing anything else, so it can't be replayed
  await db
    .from("otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id);

  const e164 = toE164(phone);

  const { data: existing } = await db
    .from("clients")
    .select("user_id, email")
    .eq("phone_digits", phone)
    .not("user_id", "is", null)
    .maybeSingle();

  const supabase = await createClient();

  /*
   * ── Opening the session without destroying their password ──────────────
   *
   * The obvious move — write a known password and sign in with it — would
   * overwrite the password they chose when completing their profile. They'd
   * set one, and it would stop working the next time they used a code.
   *
   * So there are two paths, and which one applies is decided by whether
   * there is anything to protect yet:
   *
   *   • Someone with an email has finished setting up. A one-time link is
   *     minted for that address and redeemed here, which touches nothing.
   *   • Someone brand new, or half set up, has no password of their own.
   *     A random one is written and used immediately; it never leaves this
   *     server, and their own replaces it when they finish the profile.
   */
  if (existing?.user_id && existing.email) {
    const { data: link, error } = await db.auth.admin.generateLink({
      type: "magiclink",
      email: existing.email,
    });

    const tokenHash = link?.properties?.hashed_token;
    if (error || !tokenHash) return { ok: false, error: "No se pudo iniciar sesión." };

    // Redeemed through the request-scoped client, which is what writes cookies
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "email",
    });
    if (verifyError) return { ok: false, error: "No se pudo iniciar sesión." };

    return { ok: true, isNew: false };
  }

  // A password only this server ever sees, used once to open the session
  const sessionPassword = randomBytes(24).toString("base64url");
  let isNew = false;

  if (existing?.user_id) {
    const { error } = await db.auth.admin.updateUserById(existing.user_id, {
      password: sessionPassword,
      phone: e164,
      phone_confirm: true,
    });
    if (error) return { ok: false, error: "No se pudo iniciar sesión." };
  } else {
    /*
     * `phone_confirm` is set because the code arriving is the proof — that
     * is the whole point of the exercise.
     */
    const { data: created, error } = await db.auth.admin.createUser({
      phone: e164,
      phone_confirm: true,
      password: sessionPassword,
    });
    if (error || !created.user) {
      return { ok: false, error: "No se pudo crear la cuenta." };
    }
    isNew = true;
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    phone: e164,
    password: sessionPassword,
  });

  if (signInError) return { ok: false, error: "No se pudo iniciar sesión." };

  return { ok: true, isNew };
}
