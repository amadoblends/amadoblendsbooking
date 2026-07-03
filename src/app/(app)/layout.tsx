import { BottomNav } from "@/components/ui/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-24 w-full max-w-[560px] mx-auto md:border-x md:border-border">
      {children}
      <BottomNav />
    </div>
  );
}
