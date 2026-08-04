import { redirect } from "next/navigation";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SideNav } from "@/components/ui/side-nav";
import { getSessionClient } from "@/lib/session";
import { LanguageProvider } from "@/components/i18n/language-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionClient();

  if (session.state === "anonymous") redirect("/login");
  if (session.state === "no-profile") redirect("/configurar-perfil");
  if (session.state === "needs-verification") redirect("/verificar");

  return (
    <LanguageProvider language={session.client.language}>
      <div className="min-h-dvh">
        <SideNav />
        <main className="pb-24 lg:pb-10 lg:pl-60">
          <div className="w-full max-w-[560px] lg:max-w-4xl mx-auto">{children}</div>
        </main>
        <BottomNav />
      </div>
    </LanguageProvider>
  );
}
