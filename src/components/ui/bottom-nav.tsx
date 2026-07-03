"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Plus, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

const left = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citas", label: "Reservas", icon: Calendar },
];
const right = [
  { href: "/tienda", label: "Tienda", icon: ShoppingBag },
  { href: "/perfil", label: "Perfil", icon: User },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 min-w-[56px] py-1",
        active ? "text-brand" : "text-muted"
      )}
    >
      <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}

export function BottomNav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border pb-[max(0px,var(--safe-bottom))]">
      <div className="flex items-center justify-around h-16 w-full max-w-[560px] mx-auto">
        {left.map((item) => (
          <NavItem key={item.href} {...item} active={path === item.href} />
        ))}
        <Link href="/reservar" aria-label="Reservar cita" className="-mt-5">
          <div className="w-[52px] h-[52px] rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/40 active:scale-95 transition-transform">
            <Plus size={26} className="text-white" />
          </div>
        </Link>
        {right.map((item) => (
          <NavItem key={item.href} {...item} active={path === item.href} />
        ))}
      </div>
    </nav>
  );
}
