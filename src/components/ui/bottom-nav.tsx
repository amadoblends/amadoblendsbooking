"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Scissors, User } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citas", label: "Mis citas", icon: Calendar },
  { href: "/reservar", label: "Reservar", icon: Scissors, cta: true },
  { href: "/perfil", label: "Perfil", icon: User },
];

export function BottomNav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border pb-[max(0px,var(--safe-bottom))]">
      <div className="flex items-center justify-around h-16">
        {nav.map((item) => {
          const active = path === item.href;
          if (item.cta) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/30">
                  <item.icon size={22} className="text-white" />
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[56px] py-1",
                active ? "text-brand" : "text-muted"
              )}
            >
              <item.icon size={21} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
