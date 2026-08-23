"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizePhone } from "@/lib/otp/phone";

/**
 * Finishing an account after the phone is verified.
 *
 * ── Why the email is set here and not from the browser ───────────────────
 * `auth.updateUser({ email })` does not set the email. It records a *pending*
 * change and sends a confirmation link; until that link is clicked the
 * account still has no email. So the profile would save, the email would
 * quietly not stick, and the app would ask for it again on the next screen —
 * looking broken while behaving exactly as documented.
 *
 * The admin API sets it outright, with `email_confirm: true`.
 *
 * ── What marking it confirmed actually costs ─────────────────────────────
 * Nobody proves the address is theirs. That is a smaller thing than it
 * sounds here, because the *phone* is the verified identity — the email is
 * for receipts and as a fallback way in. Claiming a stranger's address
 * grants nothing: it would only send recovery mail to someone who can't use
 * it, and Supabase already refuses an address another account holds.
 *
 * It is still a real gap, and the honest place to close it is a verification
 * mail once the domain exists. Written down here so it isn't rediscovered.
 */

const schema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(150),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  password: z.string().min(6).max(200),
  phone: z.string().trim().min(7).max(20),
});

export interface CompleteResult {
  ok: boolean;
  error?: string;
}

export async function completeProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: string;
  password: string;
  phone: string;
}): Promise<CompleteResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del formulario." };

  const { firstName, lastName, email, birthDate, password, phone } = parsed.data;

  /*
   * The identity comes from the verified session, never from the form. A
   * user id in a request body is a user id an attacker can change.
   */
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar." };

  const db = createServiceClient();
  if (!db) {
    return {
      ok: false,
      error: "Falta SUPABASE_SERVICE_ROLE_KEY. No se puede guardar el correo.",
    };
  }

  // Set outright rather than left pending — see the note at the top
  const { error: authError } = await db.auth.admin.updateUserById(user.id, {
    email,
    email_confirm: true,
    password,
  });

  if (authError) {
    const message = authError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      return { ok: false, error: "Ese correo ya lo usa otra cuenta." };
    }
    return { ok: false, error: "No se pudo guardar tu cuenta. Inténtalo de nuevo." };
  }

  const digits = normalizePhone(phone);

  /*
   * The row may already exist — a walk-in the barber recorded, now linked to
   * this account. Upserting on user_id keeps that history instead of
   * starting a second, empty one beside it.
   */
  const { error: profileError } = await db.from("clients").upsert(
    {
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      email,
      birth_date: birthDate,
      phone,
      phone_digits: digits,
    },
    { onConflict: "user_id" }
  );

  if (profileError) {
    /*
     * The unique index on phone_digits (migration 37). Two accounts on one
     * number would be two histories for one person, and the code for one
     * would open the other.
     */
    if (profileError.code === "23505") {
      return { ok: false, error: "Ese teléfono ya está registrado en otra cuenta." };
    }
    return { ok: false, error: "No se pudo guardar tu perfil. Inténtalo de nuevo." };
  }

  return { ok: true };
}
