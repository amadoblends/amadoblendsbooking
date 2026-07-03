"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, Plus, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/citas", label: "Mis reservas", icon: Calendar },
  { href: "/tienda", label: "Tienda", icon: ShoppingBag },
  { href: "/perfil", label: "Mi perfil", icon: User },
];

export function SideNav() {
  const path = usePathname();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 flex-col bg-surface border-r border-border p-5 z-20">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
          <span className="text-white font-black text-lg leading-none">A</span>
        </div>
        <span className="font-bold tracking-[0.16em] text-sm text-foreground">AMADOBLENDS</span>
      </Link>

      {/* CTA */}
      <Link
        href="/reservar"
        className="flex items-center justify-center gap-2 h-11 rounded-xl bg-brand text-white text-sm font-bold mb-6 shadow-lg shadow-brand/25 active:scale-[0.98] transition-transform"
      >
        <Plus size={17} /> Reservar cita
      </Link>

      {/* Nav */}
      <nav className="space-y-1">
        {items.map((item) => {
          const active = path === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-brand-light text-brand font-semibold"
                  : "text-muted hover:text-foreground hover:bg-background"
              )}
            >
              <item.icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <p className="mt-auto text-[10px] text-muted">Amado Blends Barbershop</p>
    </aside>
  );
}
