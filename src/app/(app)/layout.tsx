import { redirect } from "next/navigation";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SideNav } from "@/components/ui/side-nav";
import { getSessionClient } from "@/lib/session";
import { getRoles } from "@/lib/auth";
import { WrongApp } from "@/components/auth/wrong-app";
import { allowedIn, wrongAppMessage } from "@/lib/account-role";
import { getProfileState, canUseApp } from "@/lib/profile-state";
import { LanguageProvider } from "@/components/i18n/language-provider";
import { NavigationHistoryProvider } from "@/components/nav/navigation-history";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionClient();

  if (session.state === "anonymous") redirect("/login");

  /*
   * A barber's account has no business here. Checked before the profile
   * redirect below, which would otherwise send them to "set up your client
   * profile" — quietly turning the barber into a client.
   */
  const roles = await getRoles();
  if (!allowedIn(roles, "client")) {
    return <WrongApp message={wrongAppMessage(roles, "client")} />;
  }

  /*
   * A verified phone gets you in; a finished profile gets you the app.
   * Checked here rather than per page, so a half-set-up account can't reach
   * booking by typing the URL. The database refuses the appointment too —
   * see migration 37 — this is so the answer is a form rather than an error.
   */
  const profile = await getProfileState();
  if (!canUseApp(profile)) redirect("/completar-perfil");

  // Same destination, stated again so the type below is narrowed too
  if (session.state === "no-profile") redirect("/completar-perfil");

  if (session.state === "needs-verification") redirect("/verificar");

  return (
    <LanguageProvider language={session.client.language}>
      <NavigationHistoryProvider home="/">
        <div className="min-h-dvh">
          <SideNav />
          <main className="pb-24 lg:pb-10 lg:pl-60">
            <div className="w-full max-w-[560px] lg:max-w-4xl mx-auto">{children}</div>
          </main>
          <BottomNav />
        </div>
      </NavigationHistoryProvider>
    </LanguageProvider>
  );
}
