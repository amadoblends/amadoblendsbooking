"use client";

import Image from "next/image";
import { Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShopProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock?: number | null;
}

/**
 * One product in the grid.
 *
 * ── The shape the design settled on ──────────────────────────────────────
 * A white card with a border, photograph across the top, then the name and
 * the price on one line with the action beside it. The image is `cover` and
 * short — it's a glance, not a product page — and the row of price-and-
 * button gives every card the same bottom edge, which is what stops a grid
 * of different-length names from looking ragged.
 *
 * The whole card opens the product; the round button is the shortcut. Both,
 * because a 28px circle is a miss waiting to happen on a phone and the card
 * is the real target.
 */
export function ProductCard({
  product,
  onQuickAdd,
  onOpen,
  priority,
  compact,
}: {
  product: ShopProduct;
  /** The round button. Omit it and only the card is tappable. */
  onQuickAdd?: (id: string) => void;
  onOpen?: (id: string) => void;
  /** Only the first row should preload; the rest arrive as they're scrolled to. */
  priority?: boolean;
  /** The narrower card used in the horizontal rails. */
  compact?: boolean;
}) {
  const soldOut = product.stock !== undefined && product.stock !== null && product.stock <= 0;

  return (
    <div
      className={cn(
        "bg-surface rounded-[var(--radius-card)] border border-border overflow-hidden",
        soldOut && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen?.(product.id)}
        className="block w-full text-left active:opacity-90"
      >
        <div
          className="relative w-full bg-surface-tint"
          style={{ height: compact ? 80 : 112 }}
        >
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              /*
               * Two columns on a phone, so each image is about half the
               * viewport. Saying so is what stops the browser fetching a
               * 1600px original to fill a 180px box.
               */
              sizes={compact ? "112px" : "(max-width: 640px) 50vw, 220px"}
              className="object-cover"
              priority={priority}
              loading={priority ? undefined : "lazy"}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-muted">
              <Package size={compact ? 18 : 24} />
            </span>
          )}

          {soldOut && (
            <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-1 rounded-full bg-surface text-muted">
              Agotado
            </span>
          )}
        </div>
      </button>

      <div className={compact ? "p-2" : "p-3"}>
        <p
          className={cn(
            "font-semibold text-foreground leading-snug line-clamp-1",
            compact ? "text-[11px]" : "text-[13px]"
          )}
        >
          {product.name}
        </p>
        <div className={cn("flex items-center justify-between", compact ? "mt-1" : "mt-1.5")}>
          <span
            className={cn(
              "font-bold text-brand tnum",
              compact ? "text-[11px]" : "text-[13px]"
            )}
          >
            ${Number(product.price).toFixed(2)}
          </span>
          {onQuickAdd && !soldOut && (
            <button
              type="button"
              onClick={() => onQuickAdd(product.id)}
              aria-label={`Ver ${product.name}`}
              className={cn(
                "rounded-full bg-brand text-[var(--color-brand-on)] flex items-center justify-center shrink-0",
                "active:scale-90 transition-transform",
                compact ? "w-5 h-5" : "w-7 h-7"
              )}
            >
              <Plus size={compact ? 11 : 15} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
