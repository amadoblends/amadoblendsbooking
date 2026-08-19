"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Password plus confirmation, hidden by default with their own reveal.
 *
 * The pair is one component so the "they match" rule lives next to the fields
 * that produce it, rather than being re-derived by every caller.
 */
export function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  minLength = 6,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  minLength?: number;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [touched, setTouched] = useState(false);

  const tooShort = password.length > 0 && password.length < minLength;
  // Only complain once they've actually typed in the second box
  const mismatch = touched && confirm.length > 0 && password !== confirm;
  const matches = password.length >= minLength && password === confirm;

  return (
    <div className="space-y-2">
      <Field
        value={password}
        onChange={onPassword}
        show={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
        placeholder="Contraseña"
        autoComplete="new-password"
      />

      <Field
        value={confirm}
        onChange={(v) => {
          setTouched(true);
          onConfirm(v);
        }}
        show={showConfirm}
        onToggle={() => setShowConfirm((v) => !v)}
        placeholder="Confirmar contraseña"
        autoComplete="new-password"
        invalid={mismatch}
      />

      {tooShort && (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <X size={11} className="text-danger shrink-0" />
          Al menos {minLength} caracteres.
        </p>
      )}
      {mismatch && (
        <p className="text-[11px] text-danger flex items-center gap-1.5">
          <X size={11} className="shrink-0" />
          Las contraseñas no coinciden.
        </p>
      )}
      {matches && (
        <p className="text-[11px] text-success flex items-center gap-1.5">
          <Check size={11} className="shrink-0" />
          Las contraseñas coinciden.
        </p>
      )}
    </div>
  );
}

/** True when the pair is usable. */
export function passwordsOk(password: string, confirm: string, minLength = 6): boolean {
  return password.length >= minLength && password === confirm;
}

function Field({
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoComplete,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
        <Lock size={15} />
      </div>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={cn(
          "w-full h-12 pl-10 pr-12 rounded-xl border bg-background text-sm text-foreground",
          "focus:outline-none focus:ring-2 placeholder:text-muted",
          invalid ? "border-danger focus:ring-danger" : "border-border focus:ring-brand"
        )}
        required
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
