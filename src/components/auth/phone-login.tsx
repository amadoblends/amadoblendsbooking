"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, Phone, ShieldCheck } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/actions/phone-auth";
import { formatPhone, maskPhone, normalizePhone } from "@/lib/otp/phone";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/otp/provider";

/**
 * Signing in with a phone number.
 *
 * ── Two screens, not one ─────────────────────────────────────────────────
 * Number, then code. Putting both on one screen means an empty code box
 * sitting there before a code exists, which reads as broken.
 *
 * The number can be corrected from the code screen without starting over —
 * a mistyped digit is the single most likely thing to go wrong here, and
 * making someone back out and retype everything for one character is how a
 * sign-in gets abandoned.
 */
export function PhoneLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // The resend countdown, so the button says why it's unavailable
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const normalized = normalizePhone(phone);

  async function send() {
    setError(null);
    const result = await requestPhoneCode(phone);
    if (!result.ok) {
      setError(result.error ?? "No se pudo enviar el código.");
      if (result.retryIn) setCooldown(result.retryIn);
      return;
    }
    setIsDev(Boolean(result.development));
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setCode("");
    setStep("code");
  }

  async function verify() {
    setError(null);
    const result = await verifyPhoneCode(phone, code);
    if (!result.ok) {
      setError(result.error ?? "Código incorrecto.");
      return;
    }

    /*
     * Always to the completion screen. It sends anyone already finished
     * straight on to the home screen, so this doesn't have to know — and
     * the one place that decides "is this account usable" stays one place.
     */
    router.push("/completar-perfil");
    router.refresh();
  }

  if (step === "code") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setStep("phone");
            setError(null);
          }}
          className="flex items-center gap-1.5 text-[13px] text-muted"
        >
          <ArrowLeft size={15} /> Cambiar número
        </button>

        <div className="text-center">
          <div className="w-13 h-13 w-[52px] h-[52px] rounded-[var(--radius-card)] bg-brand-light flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={24} className="text-brand" />
          </div>
          <h2 className="text-[17px] font-bold text-foreground">Escribe tu código</h2>
          <p className="text-[13px] text-muted mt-1">
            Lo enviamos a{" "}
            <span className="font-semibold text-foreground tnum">
              {normalized ? maskPhone(normalized) : phone}
            </span>
          </p>
        </div>

        {/*
          * While the code is a fixed constant, the screen says so. A test
          * shortcut nobody can see is a test shortcut that reaches real
          * clients.
          */}
        {isDev && (
          <div className="flex items-start gap-2 rounded-[var(--radius-control)] border border-warning/30 bg-warning-light px-3.5 py-2.5">
            <Info size={14} className="text-warning shrink-0 mt-0.5" />
            <p className="text-[11px] text-foreground leading-relaxed">
              Modo de pruebas: todavía no se envían SMS. El código es{" "}
              <span className="font-bold tnum">000000</span>.
            </p>
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
          autoFocus
          className="w-full h-14 rounded-[var(--radius-control)] border border-border bg-background text-center text-[26px] font-black tracking-[0.4em] text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
        />

        {error && <p className="text-[13px] text-danger text-center">{error}</p>}

        <ActionButton
          onClick={verify}
          disabled={code.length < 6}
          full
          size="lg"
          busyLabel="Verificando..."
        >
          Verificar
        </ActionButton>

        <button
          onClick={send}
          disabled={cooldown > 0}
          className="w-full text-[12px] font-bold text-brand disabled:text-muted"
        >
          {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-[52px] h-[52px] rounded-[var(--radius-card)] bg-brand-light flex items-center justify-center mx-auto mb-3">
          <Phone size={24} className="text-brand" />
        </div>
        <h2 className="text-[17px] font-bold text-foreground">Entra con tu teléfono</h2>
        <p className="text-[13px] text-muted mt-1 leading-relaxed">
          Te enviamos un código. Sin contraseñas que recordar.
        </p>
      </div>

      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm font-semibold">
          +1
        </span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(787) 555-0000"
          autoFocus
          className="w-full h-13 h-[52px] pl-11 pr-4 rounded-[var(--radius-control)] border border-border bg-background text-[16px] text-foreground tnum focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
        />
      </div>

      {/* Shown back tidied, so a wrong digit is visible before sending */}
      {normalized && (
        <p className="text-[11px] text-muted text-center tnum">
          Enviaremos el código a {formatPhone(normalized)}
        </p>
      )}

      {error && <p className="text-[13px] text-danger text-center">{error}</p>}

      <ActionButton
        onClick={send}
        disabled={!normalized}
        full
        size="lg"
        busyLabel="Enviando..."
      >
        Enviar código
      </ActionButton>
    </div>
  );
}
