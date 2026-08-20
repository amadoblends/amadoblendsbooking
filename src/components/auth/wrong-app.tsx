"use client";

import { ShieldAlert, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Shown when a barber's account signs in here.
 *
 * The account is real and the password was right, so the useful thing to say
 * is which app it belongs to. Signing out is offered because otherwise the
 * session persists and every retry lands straight back here.
 */
export function WrongApp({ message }: { message: string }) {
  async function leave() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-warning-light flex items-center justify-center mx-auto">
          <ShieldAlert size={26} className="text-warning" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Cuenta incorrecta</h1>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">{message}</p>
        </div>
        <button
          onClick={leave}
          className="w-full h-12 rounded-xl border border-border bg-surface text-sm font-bold text-foreground flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}
