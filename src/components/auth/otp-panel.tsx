"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldCheck, Loader2, ArrowLeft, Pencil, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

export type OtpReason = "profile" | "session" | "email";

const REASON_TEXT: Record<OtpReason, { title: string; body: string }> = {
  profile: {
    title: "Confirma que eres tú",
    body: "Para proteger tu cuenta necesitamos verificar este cambio.",
  },
  session: {
    title: "Verifica tu identidad",
    body: "Pasó un tiempo desde tu última visita.",
  },
  email: {
    title: "Confirma tu correo",
    body: "Te enviamos un código para validar esta dirección.",
  },
};

/**
 * Self-contained OTP step: sends the code, lets the user resend it on a
 * cooldown or correct the address, and reports precise failures.
 */
export function OtpPanel({
  email,
  reason,
  onVerified,
  onBack,
  allowEmailEdit = false,
}: {
  email: string;
  reason: OtpReason;
  onVerified: () => void | Promise<void>;
  onBack?: () => void;
  allowEmailEdit?: boolean;
}) {
  const [target, setTarget] = useState(email);
  const [editingEmail, setEditingEmail] = useState(false);
  const [draftEmail, setDraftEmail] = useState(email);

  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const sentOnce = useRef(false);

  const send = useCallback(
    async (to: string) => {
      setSending(true);
      setError(null);
      setNotice(null);

      const supabase = createClient();
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: to,
        options: { shouldCreateUser: false },
      });

      setSending(false);

      if (sendError) {
        const msg = sendError.message.toLowerCase();
        setError(
          msg.includes("rate") || msg.includes("seconds")
            ? "Demasiados intentos. Espera un momento antes de pedir otro código."
            : msg.includes("not found") || msg.includes("signups")
              ? "No encontramos una cuenta con ese correo."
              : "No se pudo enviar el código. Revisa tu conexión e inténtalo otra vez."
        );
        return false;
      }

      setNotice(`Código enviado a ${to}`);
      setCooldown(RESEND_SECONDS);
      setCode("");
      setTimeout(() => inputRef.current?.focus(), 60);
      return true;
    },
    []
  );

  // Send once when the panel opens
  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    send(target);
  }, [send, target]);

  // Resend cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function verify(value: string) {
    if (value.length !== CODE_LENGTH) return;
    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: target,
      token: value,
      type: "email",
    });

    if (verifyError) {
      const msg = verifyError.message.toLowerCase();
      setError(
        msg.includes("expired")
          ? "Ese código expiró. Pide uno nuevo."
          : msg.includes("already") || msg.includes("used")
            ? "Ese código ya fue usado. Pide uno nuevo."
            : "Código incorrecto. Revísalo e inténtalo de nuevo."
      );
      setCode("");
      setVerifying(false);
      inputRef.current?.focus();
      return;
    }

    // Success — the caller applies the pending change
    try {
      await onVerified();
    } finally {
      setVerifying(false);
    }
  }

  async function applyNewEmail(e: React.FormEvent) {
    e.preventDefault();
    const next = draftEmail.trim();
    if (!next.includes("@")) {
      setError("Escribe un correo válido.");
      return;
    }
    setEditingEmail(false);
    setTarget(next);
    await send(next);
  }

  const busy = sending || verifying;

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          onClick={onBack}
          disabled={busy}
          className="flex items-center gap-1.5 text-sm text-muted disabled:opacity-50"
        >
          <ArrowLeft size={15} /> Volver
        </button>
      )}

      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
          <ShieldCheck size={26} className="text-brand" />
        </div>
        <h2 className="font-bold text-foreground text-lg">{REASON_TEXT[reason].title}</h2>
        <p className="text-sm text-muted mt-1">{REASON_TEXT[reason].body}</p>
      </div>

      {/* Where it went, with the option to fix a typo */}
      {editingEmail ? (
        <form onSubmit={applyNewEmail} className="flex gap-2">
          <input
            type="email"
            value={draftEmail}
            onChange={(e) => setDraftEmail(e.target.value)}
            autoFocus
            className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            className="h-11 px-4 rounded-xl bg-brand text-white text-sm font-semibold shrink-0"
          >
            Enviar
          </button>
        </form>
      ) : (
        <div className="bg-background rounded-xl border border-border px-3 py-2.5 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted">Enviado a</p>
            <p className="text-sm font-semibold text-foreground truncate">{target}</p>
          </div>
          {allowEmailEdit && (
            <button
              onClick={() => {
                setDraftEmail(target);
                setEditingEmail(true);
              }}
              disabled={busy}
              className="flex items-center gap-1 text-xs font-semibold text-brand shrink-0 disabled:opacity-50"
            >
              <Pencil size={11} /> Cambiar
            </button>
          )}
        </div>
      )}

      {/* Code */}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        value={code}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
          setCode(next);
          setError(null);
          // Submit as soon as the code is complete
          if (next.length === CODE_LENGTH) verify(next);
        }}
        placeholder="000000"
        className={cn(
          "w-full h-16 rounded-2xl border bg-background text-center text-3xl font-black tracking-[0.4em] text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-60",
          error ? "border-danger" : "border-border"
        )}
      />

      {error && <p className="text-sm text-danger text-center">{error}</p>}
      {notice && !error && (
        <p className="text-sm text-success text-center flex items-center justify-center gap-1.5">
          <Check size={14} /> {notice}
        </p>
      )}

      <button
        onClick={() => verify(code)}
        disabled={busy || code.length !== CODE_LENGTH}
        className="w-full h-13 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {verifying && <Loader2 size={17} className="animate-spin" />}
        {verifying ? "Verificando..." : "Confirmar"}
      </button>

      <button
        onClick={() => send(target)}
        disabled={busy || cooldown > 0}
        className="w-full text-sm font-medium text-muted py-1 disabled:opacity-60"
      >
        {sending ? (
          <span className="flex items-center justify-center gap-1.5">
            <Loader2 size={13} className="animate-spin" /> Enviando...
          </span>
        ) : cooldown > 0 ? (
          `Reenviar código en ${cooldown}s`
        ) : (
          "¿No te llegó? Reenviar código"
        )}
      </button>
    </div>
  );
}
