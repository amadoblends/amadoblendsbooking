"use client";

import { useMemo, useState } from "react";
import { Package, Sparkles, Scissors, Droplet, Wind, Grid2x2 } from "lucide-react";
import { ProductCard, type ShopProduct } from "@/components/shop/product-card";
import { CategoryRail, SectionHeader, type RailCategory } from "@/components/shop/category-rail";
import { useT } from "@/components/i18n/language-provider";

export interface ShopItem extends ShopProduct {
  category: string | null;
}

const ICONS: Record<string, React.ReactNode> = {
  all: <Grid2x2 size={18} />,
  hair: <Scissors size={18} />,
  beard: <Wind size={18} />,
  face: <Droplet size={18} />,
  styling: <Sparkles size={18} />,
  other: <Package size={18} />,
};

/**
 * The shop.
 *
 * Filtering happens here rather than on the server: the whole catalogue is a
 * few dozen rows, and a round trip per category tap would make the rail feel
 * broken. Tapping a category is instant because nothing is fetched.
 */
export function ShopView({
  products,
  categories,
}: {
  products: ShopItem[];
  categories: { id: string; label: string }[];
}) {
  const { t } = useT();
  const [active, setActive] = useState("all");

  const rail: RailCategory[] = useMemo(
    () => [
      { id: "all", label: t("shop.all"), icon: ICONS.all },
      ...categories.map((c) => ({
        id: c.id,
        label: c.label,
        icon: ICONS[c.id] ?? ICONS.other,
      })),
    ],
    [categories, t]
  );

  const shown = useMemo(
    () => (active === "all" ? products : products.filter((p) => p.category === active)),
    [products, active]
  );

  if (products.length === 0) {
    return (
      <div className="bg-surface rounded-[var(--radius-card)] border border-border p-10 text-center space-y-2">
        <Package size={30} className="text-muted mx-auto" />
        <p className="text-sm text-muted">{t("shop.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rail.length > 2 && (
        <CategoryRail categories={rail} active={active} onSelect={setActive} />
      )}

      <div className="space-y-3">
        <SectionHeader
          title={active === "all" ? t("shop.allProducts") : rail.find((r) => r.id === active)!.label}
        />

        {shown.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">{t("shop.emptyCategory")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-5">
            {shown.map((p, i) => (
              /* Only the first row preloads; the rest wait to be scrolled to */
              <ProductCard key={p.id} product={p} priority={i < 2} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
