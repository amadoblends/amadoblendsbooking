"use client";

import { Suspense, useState } from "react";
import {
  Scissors, Loader2, Mail, User, Phone, ShieldCheck, ArrowLeft, Cake,
  KeyRound, Lock, Eye, EyeOff, Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { PasswordFields, passwordsOk } from "@/components/auth/password-fields";
import { useOtpTimers, formatCountdown } from "@/components/auth/use-otp-timers";

type Mode = "login" | "register";
type Step = "form" | "otp" | "forgot" | "forgotOtp" | "forgotNew";

/** Oldest and youngest a birth date may plausibly be. */
const DOB_MAX = new Date(Date.now() - 13 * 365.25 * 86_400_000).toISOString().slice(0, 10);
const DOB_MIN = "1920-01-01";

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
  // Resend cooldown and code expiry, shown rather than guessed at
  const otpTimers = useOtpTimers();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(null);
  const [existingEmail, setExistingEmail] = useState<string | null>(null);
  /** A walk-in profile the barber already made for this person. */
  const [claimable, setClaimable] = useState<{
    id: string;
    full_name: string;
    visit_count: number;
  } | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setStep("form");
    setError(null);
    setNotice(null);
    setExistingEmail(null);
    setClaimable(null);
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
  }

  // ── Login ───────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: loginPassword,
    });

    if (error) {
      setError(
        error.message.toLowerCase().includes("not confirmed")
          ? "Tu correo aún no está verificado. Regístrate de nuevo para recibir un código."
          : "Correo o contraseña incorrectos."
      );
      setLoading(false);
      return;
    }

    /*
     * A barber's account is turned away here rather than after landing.
     * The layout refuses it too, and RLS refuses the data underneath — this
     * is only so the answer arrives at the moment of the attempt, next to
     * the form they just filled in.
     */
    const { data: roles } = await supabase.rpc("my_roles");
    const row = Array.isArray(roles) ? roles[0] : roles;
    if (row && row.is_barber && !row.is_client) {
      await supabase.auth.signOut();
      setError(
        "Esta cuenta es de un barbero. Inicia sesión desde la app del barbero."
      );
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  // ── Register: send the code ─────────────────────────────────────────────

  async function sendCode(target = email) {
    const supabase = createClient();

    /*
     * Supabase never says whether an address is taken — signInWithOtp would
     * just sign them into the existing account, which reads as a broken
     * registration. Ask first.
     */
    const { data: taken, error: checkError } = await supabase.rpc("email_has_account", {
      p_email: target,
    });
    if (!checkError && taken === true) {
      setExistingEmail(target);
      return false;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: target,
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
      return false;
    }
    otpTimers.markSent();
    setNotice(`Te enviamos un código de 6 dígitos a ${target}`);
    return true;
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsOk(password, confirmPassword)) {
      setError("Revisa la contraseña y su confirmación.");
      return;
    }
    // Checked here too: `required` alone is skipped by a browser autofill
    if (!dob) {
      setError("Necesitamos tu fecha de nacimiento.");
      return;
    }
    setLoading(true);
    setError(null);
    if (await sendCode()) setStep("otp");
    setLoading(false);
  }

  // ── Register: verify and finish ─────────────────────────────────────────

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

    // Verified — only now is it safe to set a password and create the profile
    await supabase.auth.updateUser({ password });

    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!existing) {
      /*
       * The barber may already keep a profile for this person as a walk-in.
       * Offer to adopt it rather than start a second, empty history.
       */
      const { data: match } = await supabase
        .rpc("find_unclaimed_client", { p_email: email, p_phone: phone })
        .maybeSingle();

      if (match && (match as { id: string }).id) {
        setClaimable(match as { id: string; full_name: string; visit_count: number });
        setLoading(false);
        return;
      }

      await createProfile(data.user.id);
    }

    finish();
  }

  async function createProfile(userId: string) {
    const supabase = createClient();
    await supabase.from("clients").insert({
      full_name: `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      phone: phone.trim(),
      email,
      birth_date: dob || null,
      user_id: userId,
    });
  }

  /** Adopt the barber's existing profile, keeping its history. */
  async function claimProfile() {
    setLoading(true);
    const supabase = createClient();
    const { data: ok } = await supabase.rpc("claim_client_profile", {
      p_client_id: claimable!.id,
    });

    if (ok) {
      // Fill in whatever the barber didn't have
      await supabase
        .from("clients")
        .update({
          email,
          birth_date: dob || null,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
        })
        .eq("id", claimable!.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await createProfile(user.id);
    }
    finish();
  }

  /**
   * Only here does the browser get a chance to offer "save password" — the
   * form is submitted for real, with the account already created. Prompting
   * earlier interrupted a registration that hadn't happened yet.
   */
  function finish() {
    setLoading(false);
    router.push("/");
    router.refresh();
  }

  // ── Forgot password ─────────────────────────────────────────────────────

  async function handleForgotSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    /*
     * Asked outright, because signInWithOtp deliberately blurs the answer to
     * avoid revealing which addresses are registered. On a recovery screen
     * that vagueness is the wrong trade: someone who mistyped their address
     * would sit waiting for an email that was never going to arrive.
     */
    const { data: exists } = await supabase.rpc("email_has_account", {
      p_email: email.trim(),
    });
    if (exists === false) {
      setError("No encontramos una cuenta con ese correo.");
      setLoading(false);
      return;
    }

    // shouldCreateUser:false — recovery must never invent an account
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (error) {
      setError(
        error.message.toLowerCase().includes("rate")
          ? "Demasiados intentos. Espera un minuto."
          : "No encontramos una cuenta con ese correo."
      );
      setLoading(false);
      return;
    }
    otpTimers.markSent();
    setNotice(`Te enviamos un código a ${email}`);
    setStep("forgotOtp");
    setLoading(false);
  }

  async function handleForgotVerify(e: React.FormEvent) {
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
      setError("Código incorrecto o expirado.");
      setLoading(false);
      return;
    }
    setStep("forgotNew");
    setNotice(null);
    setLoading(false);
  }

  async function handleForgotSave(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordsOk(password, confirmPassword)) {
      setError("Revisa la contraseña y su confirmación.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("No se pudo cambiar la contraseña. Intenta de nuevo.");
      setLoading(false);
      return;
    }
    /*
     * The code is single-use at the server, but the local clocks would keep
     * counting; clearing them means going back to this screen asks for a
     * fresh one rather than showing a stale countdown for a spent code.
     */
    otpTimers.reset();
    setOtp("");
    finish();
  }

  // ── The barber already knows this person ────────────────────────────────

  if (claimable) {
    return (
      <Shell>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto">
            <Check size={26} className="text-brand" />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg">Ya te conocemos</h2>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">
              Tu barbero ya tenía un perfil tuyo
              {claimable.visit_count > 0
                ? ` con ${claimable.visit_count} ${claimable.visit_count === 1 ? "visita" : "visitas"}`
                : ""}
              . Podemos unirlo a tu cuenta nueva para que conserves tu historial.
            </p>
          </div>

          <button
            onClick={claimProfile}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Sí, es mi historial
          </button>
          <button
            onClick={async () => {
              setLoading(true);
              const supabase = createClient();
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) await createProfile(user.id);
              finish();
            }}
            disabled={loading}
            className="w-full text-xs text-muted font-medium py-1"
          >
            No soy yo, empezar de cero
          </button>
        </div>
      </Shell>
    );
  }

  // ── OTP screens ─────────────────────────────────────────────────────────

  if (step === "otp" || step === "forgotOtp") {
    const forgot = step === "forgotOtp";
    return (
      <Shell>
        <button
          onClick={() => setStep(forgot ? "forgot" : "form")}
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
            Ingresa el código de 6 dígitos que enviamos a
          </p>

          {/*
            * The address is editable right here. A typo used to mean starting
            * the whole registration again to fix one character.
            */}
          <div className="flex items-center gap-1.5 mt-2 bg-background border border-border rounded-xl px-3 py-2">
            <Mail size={14} className="text-muted shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground text-center focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              setError(null);
              setOtp("");
              const ok = forgot
                ? await (async () => {
                    const supabase = createClient();
                    const { error } = await supabase.auth.signInWithOtp({
                      email,
                      options: { shouldCreateUser: false },
                    });
                    if (error) {
                      setError("No encontramos una cuenta con ese correo.");
                      return false;
                    }
                    otpTimers.markSent();
                    setNotice(`Te enviamos un código a ${email}`);
                    return true;
                  })()
                : await sendCode(email);
              if (!ok && !error) setStep(forgot ? "forgot" : "form");
              setLoading(false);
            }}
            disabled={loading || otpTimers.resendIn > 0}
            className="text-xs text-brand font-bold mt-2 disabled:text-muted"
          >
            {otpTimers.resendIn > 0
              ? `Reenviar en ${formatCountdown(otpTimers.resendIn)}`
              : "Corregir correo y reenviar"}
          </button>

          {/*
            * Saying when the code dies turns "it isn't working" into "ask for
            * a new one", which is something the person can act on.
            */}
          {otpTimers.expired ? (
            <p className="text-[11px] text-danger mt-2">
              Ese código expiró. Pide uno nuevo.
            </p>
          ) : otpTimers.expiresIn > 0 ? (
            <p className="text-[11px] text-muted/70 mt-2">
              El código vence en {formatCountdown(otpTimers.expiresIn)}
            </p>
          ) : null}
        </div>

        <form onSubmit={forgot ? handleForgotVerify : handleVerify} className="space-y-3">
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
            {forgot ? "Verificar" : "Verificar y crear cuenta"}
          </button>

          <p className="text-[11px] text-muted/70 text-center leading-relaxed pt-1">
            Si el correo trae un enlace en vez de 6 dígitos, tócalo para entrar.
          </p>
        </form>
      </Shell>
    );
  }

  // ── Forgot: ask for the address ─────────────────────────────────────────

  if (step === "forgot") {
    return (
      <Shell>
        <button
          onClick={() => {
            setStep("form");
            setError(null);
          }}
          className="flex items-center gap-1.5 text-sm text-muted mb-4"
        >
          <ArrowLeft size={15} /> Volver
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <KeyRound size={24} className="text-brand" />
          </div>
          <h2 className="font-bold text-foreground text-lg">Recuperar contraseña</h2>
          <p className="text-sm text-muted mt-1">
            Te enviaremos un código para verificar que la cuenta es tuya.
          </p>
        </div>

        <form onSubmit={handleForgotSend} className="space-y-3">
          <Field
            icon={<Mail size={15} />}
            type="email"
            placeholder="Tu correo"
            value={email}
            onChange={setEmail}
          />
          {error && <p className="text-xs text-danger text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Enviar código
          </button>
        </form>
      </Shell>
    );
  }

  // ── Forgot: the new password ────────────────────────────────────────────

  if (step === "forgotNew") {
    return (
      <Shell>
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-success-light flex items-center justify-center mx-auto mb-3">
            <Check size={26} className="text-success" />
          </div>
          <h2 className="font-bold text-foreground text-lg">Nueva contraseña</h2>
          <p className="text-sm text-muted mt-1">Elige una que recuerdes.</p>
        </div>

        <form onSubmit={handleForgotSave} className="space-y-3">
          <PasswordFields
            password={password}
            confirm={confirmPassword}
            onPassword={setPassword}
            onConfirm={setConfirmPassword}
          />
          {error && <p className="text-xs text-danger text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !passwordsOk(password, confirmPassword)}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Guardar y entrar
          </button>
        </form>
      </Shell>
    );
  }

  // ── Login / register form ───────────────────────────────────────────────

  const canRegister =
    firstName.trim().length > 1 &&
    email.includes("@") &&
    passwordsOk(password, confirmPassword);

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

            {/* Birth date: powers the birthday greeting and its discount */}
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
                <Cake size={15} />
              </div>
              <input
                type="date"
                value={dob}
                min={DOB_MIN}
                max={DOB_MAX}
                onChange={(e) => setDob(e.target.value)}
                required
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />
              {!dob && (
                <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted pointer-events-none">
                  Fecha de nacimiento
                </span>
              )}
            </div>
          </>
        )}

        <Field icon={<Mail size={15} />} type="email" placeholder="Correo electrónico" value={email} onChange={setEmail} />

        {mode === "register" ? (
          <PasswordFields
            password={password}
            confirm={confirmPassword}
            onPassword={setPassword}
            onConfirm={setConfirmPassword}
          />
        ) : (
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
              <Lock size={15} />
            </div>
            <input
              type={showLoginPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
              required
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((s) => !s)}
              aria-label={showLoginPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted"
            >
              {showLoginPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        )}

        {existingEmail && (
          <div className="bg-warning-light border border-warning/25 rounded-xl p-3.5 space-y-2.5">
            <p className="text-sm font-bold text-warning">Ese correo ya tiene cuenta</p>
            <p className="text-xs text-muted leading-relaxed">
              <span className="text-foreground font-medium">{existingEmail}</span> ya está
              registrado. Inicia sesión, o entra con Google si así creaste la cuenta.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setExistingEmail(null);
                  setMode("login");
                  setError(null);
                }}
                className="flex-1 h-10 rounded-xl bg-brand text-white text-xs font-bold"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setExistingEmail(null);
                  setEmail("");
                }}
                className="flex-1 h-10 rounded-xl border border-border text-xs font-semibold text-foreground"
              >
                Usar otro correo
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading || (mode === "register" && !canRegister)}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {mode === "login" ? "Entrar" : "Continuar"}
        </button>

        {mode === "login" ? (
          <button
            type="button"
            onClick={() => {
              setStep("forgot");
              setError(null);
              setPassword("");
              setConfirmPassword("");
            }}
            className="w-full text-xs text-brand font-semibold py-1"
          >
            ¿Olvidaste tu contraseña?
          </button>
        ) : (
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
