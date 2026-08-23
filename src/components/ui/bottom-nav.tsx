"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CalendarPlus, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";
import type { TranslationKey } from "@/lib/i18n";

/*
 * Five destinations, Book in the middle.
 *
 * Book sits centre and carries the accent because it is the one thing the
 * app exists to do — everything else is looking at what already happened.
 * It keeps its label like the rest: a raised icon with no word under it
 * reads as a "compose" button, which is not what this is.
 */
const ITEMS = [
  { href: "/", key: "nav.home" as TranslationKey, icon: Home },
  { href: "/citas", key: "nav.bookings" as TranslationKey, icon: Calendar },
  { href: "/reservar", key: "nav.book" as TranslationKey, icon: CalendarPlus, primary: true },
  { href: "/tienda", key: "nav.shop" as TranslationKey, icon: ShoppingBag },
  { href: "/perfil", key: "nav.profile" as TranslationKey, icon: User },
];

export function BottomNav() {
  const path = usePathname();
  const { t } = useT();

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-20",
        "bg-surface/95 backdrop-blur border-t border-border",
        // The home indicator on a 15 Pro Max sits under this; padding keeps
        // the labels above it rather than behind it
        "pb-[max(6px,var(--safe-bottom))]"
      )}
    >
      <ul className="flex items-end w-full max-w-[560px] mx-auto px-2 pt-2">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-label={t(item.key)}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1",
                  // Lifted out of the bar, so it reads as the main action
                  item.primary && "relative -top-3"
                )}
              >
                {item.primary ? (
                  <span className="w-14 h-14 rounded-full bg-brand text-[var(--color-brand-on)] flex items-center justify-center shadow-lg shadow-brand/25 active:scale-95 transition-transform">
                    <Icon size={25} strokeWidth={2} />
                  </span>
                ) : (
                  <>
                    <span className={cn(active ? "text-brand" : "text-muted")}>
                      <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-medium leading-none",
                        active ? "text-brand" : "text-muted"
                      )}
                    >
                      {t(item.key)}
                    </span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
