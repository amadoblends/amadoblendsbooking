import Link from "next/link";
import { Scissors } from "lucide-react";
import { PhoneLogin } from "@/components/auth/phone-login";

export const dynamic = "force-dynamic";

/**
 * Phone sign-in.
 *
 * A separate route from /login rather than a replacement: the email and
 * password flow still works, still has recovery, and is what an existing
 * client's saved password expects. Ripping it out to make room for a new
 * one is how people get locked out of accounts that were working.
 */
export default function EntrarPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      <div className="mb-7 text-center">
        <div className="w-14 h-14 rounded-[var(--radius-card)] bg-brand flex items-center justify-center mx-auto mb-3">
          <Scissors size={24} className="text-[var(--color-brand-on)]" />
        </div>
        <p className="font-display text-2xl text-foreground">Amado Blends</p>
        <p className="text-[13px] text-muted mt-0.5">Barbershop · Reserva tu cita</p>
      </div>

      <div className="w-full max-w-sm bg-surface rounded-[var(--radius-card)] border border-border p-6">
        <PhoneLogin />
      </div>

      <Link href="/login" className="mt-5 text-[12px] font-semibold text-muted">
        Prefiero entrar con correo
      </Link>
    </div>
  );
}
