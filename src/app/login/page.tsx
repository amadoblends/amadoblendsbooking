"use client";

import { useState } from "react";
import { Scissors, Loader2, Mail, Lock, User, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Correo o contraseña incorrectos.");
        setLoading(false);
      } else {
        setLoading(false);
        router.push("/");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      } else if (!data.session) {
        // Email confirmation required OR email already exists (Supabase returns no error for duplicate)
        setSuccess("¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión.");
        setLoading(false);
      } else {
        // Session available immediately (email confirmation disabled in Supabase)
        setLoading(false);
        router.push("/");
        router.refresh();
      }
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-3 shadow-lg shadow-brand/30">
          <Scissors size={28} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Amado Blends</h1>
        <p className="text-sm text-muted mt-1">Barbershop · Reserva tu cita</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-surface rounded-3xl border border-border p-6 space-y-5 shadow-sm">
        {/* Tabs */}
        <div className="flex rounded-xl bg-background border border-border p-1">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setSuccess(null); }}
              className={cn(
                "flex-1 h-9 rounded-lg text-sm font-semibold transition-colors",
                mode === m ? "bg-brand text-white shadow-sm" : "text-muted"
              )}
            >
              {m === "login" ? "Iniciar sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        {/* Google */}
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

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted">o con correo</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <>
              <Field icon={<User size={15} />} type="text" placeholder="Tu nombre completo" value={name} onChange={setName} />
              <Field icon={<Phone size={15} />} type="tel" placeholder="Teléfono (ej. 787-555-0000)" value={phone} onChange={setPhone} />
            </>
          )}
          <Field icon={<Mail size={15} />} type="email" placeholder="Correo electrónico" value={email} onChange={setEmail} />
          <Field icon={<Lock size={15} />} type="password" placeholder="Contraseña" value={password} onChange={setPassword} />

          {error && <p className="text-xs text-danger text-center">{error}</p>}
          {success && <p className="text-xs text-success text-center">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>
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
