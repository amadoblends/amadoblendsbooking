"use client";

import Image from "next/image";
import { Check, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ServiceRowItem {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  description?: string | null;
}

/**
 * One service, as a row you can pick.
 *
 * ── Why a row and not a card ─────────────────────────────────────────────
 * A service is chosen by comparing price and length against the others, and
 * comparison wants a column. In a grid the eye has to zig-zag between two
 * columns to compare four prices; in a list they line up and the decision
 * takes a second.
 *
 * The photo stays — it's what tells a fade from a taper — but small and
 * square on the left, doing its job without taking the row over.
 *
 * The circular button on the right is the whole hit target's affordance, but
 * the entire row is tappable: a 30px circle is a miss waiting to happen on a
 * phone, and the row is 76px of target.
 */
export function ServiceRow({
  service,
  selected,
  onSelect,
  priority,
}: {
  service: ServiceRowItem;
  selected?: boolean;
  onSelect: (id: string) => void;
  priority?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service.id)}
      aria-pressed={selected}
      className={cn(
        "w-full flex items-center gap-3 p-3 text-left",
        "bg-surface rounded-[var(--radius-card)] border transition-colors",
        "active:scale-[0.99] duration-100",
        selected ? "border-brand bg-brand-light" : "border-border"
      )}
    >
      <div
        className="relative w-[54px] shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-tint"
        style={{ aspectRatio: "1 / 1" }}
      >
        {service.image_url ? (
          <Image
            src={service.image_url}
            alt=""
            fill
            sizes="54px"
            className="object-cover"
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted">
            <Scissors size={17} />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-bold text-foreground leading-snug line-clamp-1">
          {service.name}
        </p>
        <p className="text-[11px] text-muted mt-0.5">{service.duration_minutes} min</p>
        <p className="text-[14px] font-bold text-foreground mt-0.5 tnum">
          ${Number(service.price).toFixed(2)}
        </p>
      </div>

      {/*
        * An empty ring that fills when chosen. A "+" would suggest adding
        * several; only one service is picked here, and the ring says that
        * without a word.
        */}
      <span
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors",
          selected ? "border-brand bg-brand text-[var(--color-brand-on)]" : "border-border"
        )}
      >
        {selected && <Check size={13} strokeWidth={3} />}
      </span>
    </button>
  );
}

/**
 * The filter pills above the list.
 *
 * Text-only pills here, unlike the shop's icon tiles: service categories are
 * words without obvious icons — "Combo" has no picture — and inventing one
 * per category would be four arbitrary glyphs to decode.
 */
export function FilterPills({
  options,
  active,
  onSelect,
}: {
  options: { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
      {options.map((o) => {
        const on = o.id === active;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            aria-pressed={on}
            className={cn(
              "shrink-0 h-8 px-3.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors",
              on
                ? "bg-brand text-[var(--color-brand-on)]"
                : "bg-surface-tint text-[var(--color-foreground-soft)]"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
