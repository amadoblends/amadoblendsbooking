"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Keeps a failed screen inside the app instead of handing the client a
 * hosting error page. Wording stays plain: nothing here is their fault, and
 * a stack trace means nothing to them.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("App:", error);
  }, [error]);

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6">
      <div className="bg-surface rounded-2xl border border-border p-6 space-y-4 text-center">
        <div className="w-14 h-14 rounded-full bg-danger-light flex items-center justify-center mx-auto">
          <AlertTriangle size={24} className="text-danger" />
        </div>
        <div>
          <p className="font-bold text-foreground">Esta pantalla no cargó</p>
          <p className="text-sm text-muted mt-1">
            Tus citas siguen guardadas. Inténtalo de nuevo.
          </p>
          {error.digest && (
            <p className="text-[10px] text-muted/60 mt-2 font-mono">{error.digest}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-brand text-white text-sm font-semibold"
          >
            <RotateCcw size={15} /> Reintentar
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            <Home size={15} /> Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
