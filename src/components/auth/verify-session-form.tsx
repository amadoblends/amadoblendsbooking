"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OtpPanel } from "@/components/auth/otp-panel";

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
          <h1 className="text-xl font-bold text-foreground">¡Hola de nuevo, {firstName}!</h1>
          <p className="text-sm text-muted mt-1.5">
            Por tu seguridad verificamos tu identidad después de {inactivityDays} días sin usar
            la app.
          </p>
        </div>

        <OtpPanel
          email={email}
          reason="session"
          onVerified={async () => {
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user) {
              // Restart the inactivity window
              await supabase
                .from("clients")
                .update({ last_seen_at: new Date().toISOString() })
                .eq("user_id", user.id);
            }
            router.push("/");
            router.refresh();
          }}
        />

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
