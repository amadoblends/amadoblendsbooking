"use client";

import { useState } from "react";
import { Scissors, Loader2, User, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ConfigurarPerfilPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) { setError("Ingresa tu nombre completo."); return; }
    if (phone.trim().length < 7) { setError("Ingresa un teléfono válido."); return; }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    /*
     * A barber landing here would otherwise be handed a client profile and
     * quietly end up holding both roles. The database refuses the insert too
     * — see migration 34 — this is so the reason is legible.
     */
    const { data: roles } = await supabase.rpc("my_roles");
    const row = Array.isArray(roles) ? roles[0] : roles;
    if (row && row.is_barber && !row.is_client) {
      setError("Esta cuenta es de un barbero. Inicia sesión desde la app del barbero.");
      setLoading(false);
      return;
    }

    const [first, ...rest] = name.trim().split(" ");
    const { error: insertError } = await supabase.from("clients").insert({
      full_name: name.trim(),
      first_name: first,
      last_name: rest.join(" ") || null,
      phone: phone.trim(),
      email: user.email ?? null,
      user_id: user.id,
      segment: "nuevo",
    });

    if (insertError) {
      setError("No se pudo guardar. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand/30">
        <Scissors size={28} className="text-white" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-1">Completa tu perfil</h1>
      <p className="text-sm text-muted mb-6 text-center">
        Necesitamos un par de datos para reservar tu cita.
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <div className="relative">
          <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Tu nombre completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </div>
        <div className="relative">
          <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="tel"
            placeholder="Teléfono (ej. 787-555-0000)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />
        </div>

        {error && <p className="text-xs text-danger text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          Guardar y continuar
        </button>
      </form>
    </div>
  );
}
