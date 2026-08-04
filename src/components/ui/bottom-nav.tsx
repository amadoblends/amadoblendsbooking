"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CalendarPlus, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n";

const left = [
  { href: "/", key: "nav.home" as TranslationKey, icon: Home },
  { href: "/citas", key: "nav.bookings" as TranslationKey, icon: Calendar },
];
const right = [
  { href: "/tienda", key: "nav.shop" as TranslationKey, icon: ShoppingBag },
  { href: "/perfil", key: "nav.profile" as TranslationKey, icon: User },
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
  const { t } = useT();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border pb-[max(0px,var(--safe-bottom))]">
      <div className="flex items-center justify-around h-16 w-full max-w-[560px] mx-auto">
        {left.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={t(item.key)}
            icon={item.icon}
            active={path === item.href}
          />
        ))}
        <Link href="/reservar" aria-label={t("nav.book")} className="-mt-5">
          <div className="w-[52px] h-[52px] rounded-2xl bg-brand flex items-center justify-center shadow-lg shadow-brand/40 active:scale-95 transition-transform">
            <CalendarPlus size={24} className="text-white" strokeWidth={2.2} />
          </div>
        </Link>
        {right.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={t(item.key)}
            icon={item.icon}
            active={path === item.href}
          />
        ))}
      </div>
    </nav>
  );
}
