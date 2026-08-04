"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Check, Globe, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AvatarUploader } from "@/components/ui/avatar-uploader";
import { LANGUAGES, type Language } from "@/lib/i18n";
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
  const router = useRouter();

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [language, setLanguage] = useState<Language>(profile.language);

  const [stage, setStage] = useState<Stage>("edit");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [switchingLang, setSwitchingLang] = useState(false);

  // Photo and language are low-risk; identity fields need a code
  const sensitiveChanged =
    firstName !== profile.firstName ||
    lastName !== profile.lastName ||
    phone !== profile.phone ||
    email !== profile.email;

  const anyChange = sensitiveChanged || avatarUrl !== profile.avatarUrl || language !== profile.language;

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
        avatar_url: avatarUrl,
        language,
      })
      .eq("id", profile.id);

    if (updateError) return "No se pudieron guardar los cambios.";

    // Changing the login email needs Supabase's own confirmation round-trip
    if (email.trim() !== profile.email) {
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) {
        return "Datos guardados, pero el correo de acceso no cambió: " + authError.message;
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
    setLoading(true);
    setError(null);

    // Low-risk edits save straight away
    if (!sensitiveChanged) {
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

    // Identity changed → confirm ownership of the account first
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: profile.email,
      options: { shouldCreateUser: false },
    });

    if (otpError) {
      setError("No se pudo enviar el código. Inténtalo en un minuto.");
      setLoading(false);
      return;
    }

    setNotice(`Enviamos un código a ${profile.email}`);
    setStage("otp");
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: profile.email,
      token: otp.trim(),
      type: "email",
    });

    if (verifyError) {
      setError("Código incorrecto o expirado.");
      setLoading(false);
      return;
    }

    const failure = await persist();
    setLoading(false);
    if (failure) {
      setError(failure);
      return;
    }
    setStage("saved");
    router.refresh();
  }

  // ── Saved ───────────────────────────────────────────────────────────────

  if (stage === "saved") {
    return (
      <div className="bg-success-light rounded-2xl border border-success/20 p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <Check size={22} className="text-success" />
        </div>
        <p className="text-sm font-semibold text-success">¡Perfil actualizado!</p>
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
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <button
          onClick={() => setStage("edit")}
          className="flex items-center gap-1.5 text-sm text-muted"
        >
          <ArrowLeft size={15} /> Volver a editar
        </button>

        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={26} className="text-brand" />
          </div>
          <h2 className="font-bold text-foreground">Confirma que eres tú</h2>
          <p className="text-sm text-muted mt-1">{notice}</p>
        </div>

        <form onSubmit={handleVerify} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-full h-14 rounded-xl border border-border bg-background text-center text-2xl font-black tracking-[0.4em] text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            autoFocus
            required
          />

          {error && <p className="text-xs text-danger text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Confirmar y guardar
          </button>
        </form>
      </div>
    );
  }

  // ── Edit form ───────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="bg-surface rounded-2xl border border-border p-5 space-y-4">
        <AvatarUploader
          value={avatarUrl}
          fallback={(firstName[0] ?? "?").toUpperCase()}
          onChange={setAvatarUrl}
        />

        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Nombre" value={firstName} onChange={setFirstName} required />
          <LabeledInput label="Apellido" value={lastName} onChange={setLastName} />
        </div>

        <LabeledInput label="Teléfono" value={phone} onChange={setPhone} type="tel" required />
        <LabeledInput label="Correo electrónico" value={email} onChange={setEmail} type="email" required />
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
