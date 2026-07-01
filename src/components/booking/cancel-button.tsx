"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function CancelButton({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelada" })
      .eq("id", appointmentId);

    if (error) {
      setError("No se pudo cancelar. Intenta de nuevo.");
      setLoading(false);
    } else {
      router.push("/citas");
      router.refresh();
    }
  }

  if (confirming) {
    return (
      <div className="bg-danger-light border border-danger/20 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-semibold text-danger">¿Seguro que quieres cancelar?</p>
        <p className="text-xs text-muted">Esta acción no se puede deshacer.</p>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            No, mantener
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-danger text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Sí, cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full h-12 rounded-xl border border-danger/30 text-danger font-semibold text-sm"
    >
      Cancelar cita
    </button>
  );
}
