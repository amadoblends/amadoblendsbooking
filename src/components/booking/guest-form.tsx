"use client";

import { useState } from "react";
import { Loader2, User, Phone, Mail, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function GuestForm({
  appointmentId,
  onDone,
}: {
  appointmentId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Ingresa el nombre del invitado.");
      return;
    }
    if (phone.trim().length < 7) {
      setError("Ingresa un teléfono válido.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("appointment_guests").insert({
      appointment_id: appointmentId,
      full_name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || null,
    });

    if (insertError) {
      setError("No se pudo agregar el invitado. Intenta de nuevo.");
      setLoading(false);
      return;
    }
    setLoading(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Nombre completo del invitado"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
          required
        />
      </div>
      <div className="relative">
        <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="tel"
          placeholder="Teléfono"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
          required
        />
      </div>
      <div className="relative">
        <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="email"
          placeholder="Correo (opcional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
        />
      </div>

      {error && <p className="text-xs text-danger text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        Agregar invitado
      </button>
    </form>
  );
}
