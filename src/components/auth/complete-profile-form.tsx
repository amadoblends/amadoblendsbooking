"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cake, Check, Lock, Mail, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordFields, passwordsOk } from "@/components/auth/password-fields";
import { ActionButton } from "@/components/ui/action-button";
import { formatPhone } from "@/lib/otp/phone";
import type { ProfileField } from "@/lib/profile-state";

/** Nobody booking a haircut is under 13, and nobody was born in 1919. */
const DOB_MAX = new Date(Date.now() - 13 * 365.25 * 86_400_000).toISOString().slice(0, 10);
const DOB_MIN = "1920-01-01";

/**
 * The rest of the account, once the phone is verified.
 *
 * ── What it deliberately does not ask ────────────────────────────────────
 * The phone. It was proved a moment ago, it is what the account is keyed on,
 * and asking again invites a typo that would silently point the profile at a
 * different number from the one that was verified. It's shown, locked, with
 * a tick — so the person can see it arrived rather than wondering whether
 * the form lost it.
 *
 * An existing client with three of five fields is asked for two. Making
 * someone retype what the barber already has is how a "quick" form becomes
 * one nobody finishes.
 */
export function CompleteProfileForm({
  phone,
  missing,
  isNew,
}: {
  phone: string | null;
  /** Empty means ask for everything — a brand new account. */
  missing: ProfileField[];
  isNew: boolean;
}) {
  const router = useRouter();
  const ask = (f: ProfileField) => missing.length === 0 || missing.includes(f);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);

    if (ask("first_name") && firstName.trim().length < 2) {
      setError("Escribe tu nombre.");
      return;
    }
    if (ask("last_name") && lastName.trim().length < 2) {
      setError("Escribe tu apellido.");
      return;
    }
    if (ask("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Escribe un correo válido.");
      return;
    }
    if (ask("birth_date") && !dob) {
      setError("Escribe tu fecha de nacimiento.");
      return;
    }
    if (!passwordsOk(password, confirm)) {
      setError("Revisa la contraseña y su confirmación.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    /*
     * The email goes onto the auth account as well as the profile. It's what
     * password recovery uses, and what mints the session on later code
     * logins — an account with an email in `clients` and none in auth can
     * do neither.
     */
    const { error: authError } = await supabase.auth.updateUser({
      email: email.trim() || undefined,
      password,
    });

    if (authError) {
      setError(
        authError.message.toLowerCase().includes("already")
          ? "Ese correo ya está en uso por otra cuenta."
          : "No se pudo guardar. Inténtalo de nuevo."
      );
      return;
    }

    const fields = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email: email.trim(),
      birth_date: dob,
      phone: phone ?? "",
      user_id: user.id,
    };

    /*
     * Upsert on user_id: the row may already exist from a walk-in the barber
     * linked, and starting a second one would split the history in two.
     */
    const { error: saveError } = await supabase
      .from("clients")
      .upsert(fields, { onConflict: "user_id" });

    if (saveError) {
      setError("No se pudo guardar tu perfil. Inténtalo de nuevo.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-[19px] font-bold text-foreground">
          {isNew ? "Completa tu cuenta" : "Completa tu perfil"}
        </h1>
        <p className="text-[13px] text-muted mt-1 leading-relaxed">
          {isNew
            ? "Nos falta esto para poder reservarte citas."
            : "Solo lo que falta para poder reservar."}
        </p>
      </div>

      {/* Verified, shown, and not editable */}
      {phone && (
        <div className="flex items-center gap-2.5 rounded-[var(--radius-control)] border border-success/30 bg-success-light px-3.5 h-12">
          <Phone size={15} className="text-success shrink-0" />
          <span className="flex-1 text-sm font-semibold text-foreground tnum">
            {formatPhone(phone)}
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-success shrink-0">
            <Check size={13} strokeWidth={3} /> Verificado
          </span>
        </div>
      )}

      {(ask("first_name") || ask("last_name")) && (
        <div className="grid grid-cols-2 gap-2">
          {ask("first_name") && (
            <Field icon={<User size={15} />} placeholder="Nombre" value={firstName} onChange={setFirstName} />
          )}
          {ask("last_name") && (
            <Field icon={<User size={15} />} placeholder="Apellido" value={lastName} onChange={setLastName} />
          )}
        </div>
      )}

      {ask("email") && (
        <Field
          icon={<Mail size={15} />}
          placeholder="Correo electrónico"
          value={email}
          onChange={setEmail}
          type="email"
        />
      )}

      {ask("birth_date") && (
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
            <Cake size={15} />
          </span>
          <input
            type="date"
            value={dob}
            min={DOB_MIN}
            max={DOB_MAX}
            onChange={(e) => setDob(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-[var(--radius-control)] border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {!dob && (
            <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
              Fecha de nacimiento
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Lock size={13} className="text-muted shrink-0" />
        <p className="text-[11px] text-muted">
          Una contraseña, por si algún día no puedes recibir el código.
        </p>
      </div>

      <PasswordFields
        password={password}
        confirm={confirm}
        onPassword={setPassword}
        onConfirm={setConfirm}
      />

      {error && <p className="text-[13px] text-danger text-center">{error}</p>}

      <ActionButton onClick={save} full size="lg" busyLabel="Guardando...">
        Guardar y continuar
      </ActionButton>
    </div>
  );
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 pl-10 pr-3 rounded-[var(--radius-control)] border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
      />
    </div>
  );
}
