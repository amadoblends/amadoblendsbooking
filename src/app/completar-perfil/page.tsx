import { redirect } from "next/navigation";
import { Scissors } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getProfileState } from "@/lib/profile-state";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";

export const dynamic = "force-dynamic";

/**
 * The step between "your phone is yours" and "you can book".
 *
 * Outside the (app) layout on purpose: that layout has the bottom navigation,
 * and offering tabs to someone who can't use any of them is an invitation to
 * bounce off five locked screens.
 */
export default async function CompletarPerfilPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfileState();
  // Nothing to complete — don't make them look at a form for no reason
  if (profile.state === "complete") redirect("/");

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-background">
      <div className="mb-6 text-center">
        <div className="w-14 h-14 rounded-[var(--radius-card)] bg-brand flex items-center justify-center mx-auto mb-3">
          <Scissors size={24} className="text-[var(--color-brand-on)]" />
        </div>
        <p className="font-display text-xl text-foreground">Amado Blends</p>
      </div>

      <div className="w-full max-w-sm bg-surface rounded-[var(--radius-card)] border border-border p-6">
        <CompleteProfileForm
          phone={profile.phone}
          missing={profile.missing}
          isNew={profile.state === "no-profile"}
        />
      </div>
    </div>
  );
}
