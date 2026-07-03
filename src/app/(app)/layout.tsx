import { BottomNav } from "@/components/ui/bottom-nav";
import { SideNav } from "@/components/ui/side-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SideNav />
      <main className="pb-24 lg:pb-10 lg:pl-60">
        <div className="w-full max-w-[560px] lg:max-w-4xl mx-auto">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
