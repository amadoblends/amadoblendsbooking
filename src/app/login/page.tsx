"use client";

import { Suspense, useState } from "react";
import {
  Scissors, Loader2, Mail, Lock, User, Phone, Eye, EyeOff, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
type Step = "form" | "otp";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setError(null);
    setNotice(null);
    setOtp("");
  }

  // ── Google ──────────────────────────────────────────────────────────────

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates away — keep the spinner up
  }

  // ── Login ───────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message.toLowerCase().includes("not confirmed")
          ? "Tu correo aún no está verificado. Regístrate de nuevo para recibir un código."
          : "Correo o contraseña incorrectos."
      );
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  // ── Register: step 1 — send the code ────────────────────────────────────

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // Creates the auth user only once the code is verified
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          full_name: `${firstName} ${lastName}`.trim(),
          first_name: firstName,
          last_name: lastName,
          phone,
        },
      },
    });

    if (error) {
      setError(
        error.message.toLowerCase().includes("rate")
          ? "Demasiados intentos. Espera un minuto e inténtalo otra vez."
          : error.message
      );
      setLoading(false);
      return;
    }

    setNotice(`Te enviamos un código de 6 dígitos a ${email}`);
    setStep("otp");
    setLoading(false);
  }

  // ── Register: step 2 — verify and finish ────────────────────────────────

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: "email",
    });

    if (error || !data.user) {
      setError("Código incorrecto o expirado. Revisa tu correo e inténtalo de nuevo.");
      setLoading(false);
      return;
    }

    // Verified → now it's safe to set the password and create the profile
    await supabase.auth.updateUser({ password });

    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from("clients").insert({
        full_name: `${firstName} ${lastName}`.trim(),
        first_name: firstName,
        last_name: lastName,
        phone: phone.trim(),
        email,
        user_id: data.user.id,
        segment: "nuevo",
      });
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  async function resendCode() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setNotice(error ? null : "Te reenviamos el código.");
    if (error) setError("No se pudo reenviar. Espera un minuto.");
    setLoading(false);
  }

  // ── OTP screen ──────────────────────────────────────────────────────────

  if (step === "otp") {
    return (
      <Shell>
        <button
          onClick={() => setStep("form")}
          className="flex items-center gap-1.5 text-sm text-muted mb-4"
        >
          <ArrowLeft size={15} /> Volver
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={26} className="text-brand" />
          </div>
          <h2 className="font-bold text-foreground text-lg">Verifica tu correo</h2>
          <p className="text-sm text-muted mt-1">
            Ingresa el código de 6 dígitos que enviamos a{" "}
            <span className="text-foreground font-medium">{email}</span>
          </p>
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
          {notice && !error && <p className="text-xs text-success text-center">{notice}</p>}

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Verificar y crear cuenta
          </button>

          <button
            type="button"
            onClick={resendCode}
            disabled={loading}
            className="w-full text-xs text-muted font-medium py-1"
          >
            ¿No recibiste el código? Reenviar
          </button>
        </form>
      </Shell>
    );
  }

  // ── Login / register form ───────────────────────────────────────────────

  return (
    <Shell>
      <div className="flex rounded-xl bg-background border border-border p-1 mb-5">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={cn(
              "flex-1 h-9 rounded-lg text-sm font-semibold transition-colors",
              mode === m ? "bg-brand text-white shadow-sm" : "text-muted"
            )}
          >
            {m === "login" ? "Iniciar sesión" : "Registrarse"}
          </button>
        ))}
      </div>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="w-full h-12 rounded-xl border border-border bg-surface flex items-center justify-center gap-3 font-medium text-sm text-foreground active:bg-background disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continuar con Google
      </button>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted">o con correo</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={mode === "login" ? handleLogin : handleSendCode} className="space-y-3">
        {mode === "register" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field icon={<User size={15} />} type="text" placeholder="Nombre" value={firstName} onChange={setFirstName} />
              <Field icon={<User size={15} />} type="text" placeholder="Apellido" value={lastName} onChange={setLastName} />
            </div>
            <Field icon={<Phone size={15} />} type="tel" placeholder="Teléfono" value={phone} onChange={setPhone} />
          </>
        )}

        <Field icon={<Mail size={15} />} type="email" placeholder="Correo electrónico" value={email} onChange={setEmail} />
        <PasswordField value={password} onChange={setPassword} />

        {error && <p className="text-xs text-danger text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Entrar" : "Continuar"}
        </button>

        {mode === "register" && (
          <p className="text-[11px] text-muted text-center leading-relaxed">
            Te enviaremos un código para verificar tu correo antes de crear la cuenta.
          </p>
        )}
      </form>
    </Shell>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      <div className="mb-7 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand/30">
          <Scissors size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Amado Blends</h1>
        <p className="text-sm text-muted mt-1">Barbershop · Reserva tu cita</p>
      </div>

      <div className="w-full max-w-sm bg-surface rounded-3xl border border-border p-6 shadow-sm">
        {children}
      </div>

      <p className="text-xs text-muted mt-6 text-center max-w-xs">
        Al continuar aceptas los términos y condiciones de Amado Blends Barbershop.
      </p>
    </div>
  );
}

function Field({
  icon,
  type,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icon}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
        required
      />
    </div>
  );
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
        <Lock size={15} />
      </div>
      <input
        type={show ? "text" : "password"}
        placeholder="Contraseña"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={6}
        className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
