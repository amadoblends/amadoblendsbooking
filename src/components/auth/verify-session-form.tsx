"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function VerifySessionForm({
  email,
  firstName,
  inactivityDays,
}: {
  email: string;
  firstName: string;
  inactivityDays: number;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) {
      setError("No se pudo enviar el código. Inténtalo de nuevo en un minuto.");
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  async function verify(e: React.FormEvent) {
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

    // Identity confirmed — restart the inactivity window
    await supabase
      .from("clients")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("user_id", data.user.id);

    setLoading(false);
    router.push("/");
    router.refresh();
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm bg-surface rounded-3xl border border-border p-6 space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={28} className="text-brand" />
          </div>
          <h1 className="text-xl font-bold text-foreground">¡Hola de nuevo, {firstName}!</h1>
          <p className="text-sm text-muted mt-1.5">
            Por tu seguridad, verificamos tu identidad después de {inactivityDays} días sin usar la
            app.
          </p>
        </div>

        {!sent ? (
          <>
            <div className="bg-background rounded-xl border border-border p-3 text-center">
              <p className="text-xs text-muted">Enviaremos un código a</p>
              <p className="text-sm font-semibold text-foreground truncate">{email}</p>
            </div>

            {error && <p className="text-xs text-danger text-center">{error}</p>}

            <button
              onClick={sendCode}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Enviarme el código
            </button>
          </>
        ) : (
          <form onSubmit={verify} className="space-y-3">
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
              Continuar
            </button>

            <button
              type="button"
              onClick={sendCode}
              disabled={loading}
              className="w-full text-xs text-muted font-medium py-1"
            >
              Reenviar código
            </button>
          </form>
        )}

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-xs text-muted font-medium pt-2 border-t border-border"
        >
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
