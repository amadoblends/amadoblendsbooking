"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Package, Scissors, X } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import type { ShopItem } from "@/components/shop/shop-view";

/**
 * One product, opened from the grid.
 *
 * ── Why a sheet and not a page ───────────────────────────────────────────
 * Looking at a product is a glance, not a destination: you check the price,
 * read a line, and go back to browsing. A route would push a navigation
 * entry and lose the scroll position of the grid behind it. A sheet keeps
 * the grid exactly where it was.
 *
 * ── About the cart the design shows ──────────────────────────────────────
 * The mockup has a basket with quantities and a total. Nothing here can
 * charge a card — there's no checkout, no payment provider, no orders table
 * — so a basket would fill up and then have nowhere to go, which is a worse
 * experience than not offering one. What exists instead is what the shop
 * actually does: buy it online if there's a link, or ask for it in the
 * chair. A real basket becomes possible the day payments do.
 */
export function ProductSheet({
  product,
  onClose,
}: {
  product: ShopItem | null;
  onClose: () => void;
}) {
  const { t } = useT();

  // Escape closes it, and the page behind mustn't scroll under the sheet
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [product, onClose]);

  if (!product) return null;

  const soldOut = product.stock !== null && product.stock !== undefined && product.stock <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        aria-label={t("common.cancel")}
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />

      <div className="relative w-full max-w-[560px] bg-surface rounded-t-[26px] animate-sheet-in max-h-[88dvh] overflow-y-auto no-scrollbar pb-[max(20px,var(--safe-bottom))]">
        {/* The grabber, so it reads as something you can pull down */}
        <div className="sticky top-0 bg-surface pt-3 pb-1 flex items-center justify-center">
          <span aria-hidden className="w-9 h-1 rounded-full bg-border" />
          <button
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="absolute right-4 top-2 w-8 h-8 rounded-full bg-surface-tint flex items-center justify-center text-muted"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-2 space-y-4">
          <div
            className="relative w-full rounded-[var(--radius-card)] overflow-hidden bg-surface-tint"
            style={{ aspectRatio: "4 / 3" }}
          >
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 560px"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-muted">
                <Package size={32} />
              </span>
            )}
          </div>

          <div>
            <h2 className="text-[19px] font-bold text-foreground leading-snug">
              {product.name}
            </h2>
            <p className="text-[20px] font-bold text-brand mt-1 tnum">
              ${Number(product.price).toFixed(2)}
            </p>
          </div>

          {product.description && (
            <p className="text-[13px] text-[var(--color-foreground-soft)] leading-relaxed">
              {product.description}
            </p>
          )}

          {soldOut ? (
            <p className="text-[13px] text-muted text-center py-3">{t("shop.soldOut")}</p>
          ) : (
            <div className="space-y-2">
              {product.purchase_url && (
                <a
                  href={product.purchase_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 rounded-[var(--radius-control)] bg-brand text-[var(--color-brand-on)] text-sm font-bold flex items-center justify-center gap-2"
                >
                  <ExternalLink size={15} /> {t("shop.buyOnline")}
                </a>
              )}

              {/*
               * The other way to get it: mention it at the appointment. It's
               * what actually happens in the shop, so it's offered rather
               * than pretended around.
               */}
              <Link
                href="/reservar"
                className="w-full h-12 rounded-[var(--radius-control)] border border-border bg-surface text-sm font-bold text-foreground flex items-center justify-center gap-2"
              >
                <Scissors size={15} /> {t("shop.askAtShop")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
