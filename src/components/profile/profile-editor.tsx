"use client";

import Image from "next/image";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Check, Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OtpPanel } from "@/components/auth/otp-panel";
import { LANGUAGES, type Language } from "@/lib/i18n";
import { useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  avatarUrl: string | null;
  language: Language;
}

type Stage = "edit" | "otp" | "saved";

export function ProfileEditor({ profile }: { profile: ProfileData }) {
  const { t } = useT();
  const router = useRouter();

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  // Read-only here; the barber owns it (see below)
  const avatarUrl = profile.avatarUrl;
  const [language, setLanguage] = useState<Language>(profile.language);

  const [stage, setStage] = useState<Stage>("edit");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switchingLang, setSwitchingLang] = useState(false);

  // Photo and language are low-risk; identity fields need a code
  const sensitiveChanged =
    firstName !== profile.firstName ||
    lastName !== profile.lastName ||
    phone !== profile.phone ||
    email !== profile.email;

  const anyChange = sensitiveChanged || language !== profile.language;

  // Language is applied app-wide, so switch it right away with a short
  // loading state instead of waiting for the rest of the form to be saved
  async function applyLanguage(next: Language) {
    if (next === language) return;
    setLanguage(next);
    setSwitchingLang(true);
    const supabase = createClient();
    await supabase.from("clients").update({ language: next }).eq("id", profile.id);
    router.refresh();
    // Give the refreshed server components a beat to swap in
    setTimeout(() => setSwitchingLang(false), 600);
  }

  async function persist() {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("clients")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone: phone.trim(),
        email: email.trim(),
        language,
      })
      .eq("id", profile.id);

    if (updateError) return "No se pudieron guardar los cambios.";

    // Changing the login email needs Supabase's own confirmation round-trip
    if (email.trim() !== profile.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) {
        return t("profile.emailUnchanged") + " " + authError.message;
      }
    }
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (firstName.trim().length < 2) {
      setError("Ingresa tu nombre.");
      return;
    }
    setError(null);

    // Photo and language are low risk — save straight away
    if (!sensitiveChanged) {
      setLoading(true);
      const failure = await persist();
      setLoading(false);
      if (failure) {
        setError(failure);
        return;
      }
      setStage("saved");
      router.refresh();
      return;
    }

    // Identity changed → OtpPanel sends the code and applies the change
    setStage("otp");
  }

  // ── Saved ───────────────────────────────────────────────────────────────

  if (stage === "saved") {
    return (
      <div className="bg-success-light rounded-2xl border border-success/20 p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <Check size={22} className="text-success" />
        </div>
        <p className="text-sm font-semibold text-success">{t("profile.updated")}</p>
        {email.trim() !== profile.email && (
          <p className="text-xs text-muted">
            Revisa tu correo nuevo para confirmar el cambio de dirección de acceso.
          </p>
        )}
        <button
          onClick={() => router.push("/perfil")}
          className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
        >
          Volver al perfil
        </button>
      </div>
    );
  }

  // ── OTP gate ────────────────────────────────────────────────────────────

  if (stage === "otp") {
    return (
      <div className="bg-surface rounded-2xl border border-border p-5">
        <OtpPanel
          email={profile.email}
          reason="profile"
          onBack={() => setStage("edit")}
          onVerified={async () => {
            // Identity proven — now write the pending changes
            const failure = await persist();
            if (failure) {
              setError(failure);
              setStage("edit");
              return;
            }
            setStage("saved");
            router.refresh();
          }}
        />
        {error && <p className="text-sm text-danger text-center mt-3">{error}</p>}
      </div>
    );
  }

  // ── Edit form ───────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        {/*
          * The photo is shown, not edited.
          *
          * It's the barber's reference for who is in the chair, so only they
          * set it — a database trigger reverts any avatar change that doesn't
          * come from an admin. The uploader used to be here anyway, which was
          * the worst of both: the client watched it change and the database
          * quietly put it back.
          */}
        <div className="flex items-center gap-3.5">
          <div className="w-16 h-16 rounded-full bg-surface-tint flex items-center justify-center shrink-0 relative overflow-hidden">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="" fill sizes="64px" className="object-cover" />
            ) : (
              <span className="text-xl font-bold text-muted">
                {(firstName[0] ?? "?").toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted leading-relaxed">{t("profile.photoByBarber")}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label={t("profile.firstName")} value={firstName} onChange={setFirstName} required />
          <LabeledInput label={t("profile.lastName")} value={lastName} onChange={setLastName} />
        </div>

        <LabeledInput label={t("profile.phone")} value={phone} onChange={setPhone} type="tel" required />
        <LabeledInput label={t("profile.email")} value={email} onChange={setEmail} type="email" required />
      </div>

      {/* Language */}
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-brand" />
          <p className="font-semibold text-sm text-foreground">Idioma / Language</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              disabled={switchingLang}
              onClick={() => applyLanguage(l.code)}
              className={cn(
                "h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60",
                language === l.code
                  ? "bg-brand border-brand text-white"
                  : "border-border bg-background text-foreground"
              )}
            >
              {switchingLang && language === l.code ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span>{l.flag}</span>
              )}
              {l.label}
            </button>
          ))}
        </div>
        {switchingLang && (
          <p className="text-xs text-muted text-center">Aplicando idioma / Applying language...</p>
        )}
      </div>

      {sensitiveChanged && (
        <div className="bg-brand-light rounded-xl p-3 border border-brand/20 flex items-start gap-2">
          <ShieldCheck size={15} className="text-brand shrink-0 mt-0.5" />
          <p className="text-xs text-brand">
            Cambiaste información importante. Te enviaremos un código a tu correo para confirmar.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !anyChange}
        className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {sensitiveChanged ? "Continuar y verificar" : "Guardar cambios"}
      </button>
    </form>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full h-12 px-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </div>
  );
}
