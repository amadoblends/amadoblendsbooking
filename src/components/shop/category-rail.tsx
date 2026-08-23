"use client";

import { cn } from "@/lib/utils";

export interface RailCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * The row of categories above a grid.
 *
 * ── The proportions the reference gets right ─────────────────────────────
 * Icon above label, not beside it, in a tile a little taller than it is
 * wide. That shape is what lets five fit across a phone while each stays
 * tappable — a horizontal pill with an icon runs out of room after three.
 *
 * The selected one fills; the rest are plain. No outline on the unselected
 * ones: a row of five bordered boxes is five competing rectangles, and the
 * eye can't find the active one. Whitespace separates them instead.
 *
 * It scrolls, but the first five are sized to fit without scrolling on a
 * phone — a rail that always needs a swipe hides its own options.
 */
export function CategoryRail({
  categories,
  active,
  onSelect,
}: {
  categories: RailCategory[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {categories.map((c) => {
        const on = c.id === active;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            aria-pressed={on}
            className={cn(
              "shrink-0 w-[68px] rounded-[var(--radius-card)] py-2.5 px-1",
              "flex flex-col items-center gap-1.5 transition-colors",
              "active:scale-95 duration-100",
              on ? "bg-brand text-[var(--color-brand-on)]" : "bg-surface text-muted"
            )}
          >
            <span className="shrink-0">{c.icon}</span>
            <span
              className={cn(
                "text-[10px] font-semibold leading-tight text-center line-clamp-1",
                on ? "text-[var(--color-brand-on)]" : "text-foreground"
              )}
            >
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A section heading with an optional link on the right.
 *
 * 15px semibold, not a 28px display face. The reference's section headers
 * are quiet — the photography below is what's meant to be looked at, and a
 * heavy header competes with it.
 */
export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onClick?: () => void; href?: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {action &&
        (action.href ? (
          <a href={action.href} className="text-[12px] font-semibold text-brand shrink-0">
            {action.label} →
          </a>
        ) : (
          <button
            type="button"
            onClick={action.onClick}
            className="text-[12px] font-semibold text-brand shrink-0"
          >
            {action.label} →
          </button>
        ))}
    </div>
  );
}
