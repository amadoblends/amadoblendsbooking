"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Package, Search, X } from "lucide-react";
import { ProductCard, type ShopProduct } from "@/components/shop/product-card";
import { FilterPills } from "@/components/booking/service-row";
import { SectionHeader } from "@/components/shop/category-rail";
import { ProductSheet } from "@/components/shop/product-sheet";
import { useT } from "@/components/i18n/language-provider";

export interface ShopItem extends ShopProduct {
  category: string | null;
  description: string | null;
  purchase_url: string | null;
  created_at: string;
  units_sold: number;
}

/**
 * The shop.
 *
 * ── Three sections, one list ─────────────────────────────────────────────
 * Best sellers, collections, new arrivals. They are three views of the same
 * catalogue rather than three lists: with a couple of dozen products, real
 * separate lists would repeat the same bottles three times over. Sorting
 * decides what each section holds, so the sections stay meaningful as the
 * catalogue grows and disappear on their own when there isn't enough to
 * fill them.
 *
 * Searching and filtering happen here, not on the server: the catalogue is
 * small, and a round trip per keystroke would make the box feel broken.
 */
export function ShopView({
  products,
  categories,
}: {
  products: ShopItem[];
  categories: { id: string; label: string }[];
}) {
  const { t } = useT();
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ShopItem | null>(null);

  const pills = useMemo(
    () => [{ id: "all", label: t("shop.all") }, ...categories],
    [categories, t]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "all" || p.category === cat) &&
        (q === "" || p.name.toLowerCase().includes(q))
    );
  }, [products, cat, query]);

  // Most sold first; the section is only worth showing with enough to fill it
  const bestSellers = useMemo(
    () => [...filtered].sort((a, b) => b.units_sold - a.units_sold).slice(0, 4),
    [filtered]
  );

  const newest = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 8),
    [filtered]
  );

  /*
   * A collection is a category with a photograph — borrowed from the first
   * product in it, so there's nothing extra for the barber to upload.
   */
  const collections = useMemo(
    () =>
      categories
        .map((c) => {
          const first = products.find((p) => p.category === c.id && p.image_url);
          return first ? { ...c, image: first.image_url! } : null;
        })
        .filter(Boolean)
        .slice(0, 4) as { id: string; label: string; image: string }[],
    [categories, products]
  );

  const searching = query.trim().length > 0 || cat !== "all";

  if (products.length === 0) {
    return (
      <div className="bg-surface rounded-[var(--radius-card)] border border-border p-10 text-center space-y-2">
        <Package size={30} className="text-muted mx-auto" />
        <p className="text-sm text-muted">{t("shop.empty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-center gap-2 bg-surface border border-border rounded-[var(--radius-control)] px-3 h-11">
          <Search size={17} className="text-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("shop.search")}
            className="flex-1 min-w-0 text-sm bg-transparent outline-none text-foreground placeholder:text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t("common.cancel")}
              className="text-muted shrink-0"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {pills.length > 1 && <FilterPills options={pills} active={cat} onSelect={setCat} />}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">{t("shop.emptyCategory")}</p>
        ) : searching ? (
          /*
           * While filtering, the sections are noise — the person is looking
           * for one thing. One grid of exactly what matched.
           */
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                priority={i < 2}
                onOpen={() => setOpen(p)}
                onQuickAdd={() => setOpen(p)}
              />
            ))}
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <SectionHeader title={t("shop.bestSellers")} />
              <div className="grid grid-cols-2 gap-3">
                {bestSellers.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    priority={i < 2}
                    onOpen={() => setOpen(p)}
                    onQuickAdd={() => setOpen(p)}
                  />
                ))}
              </div>
            </section>

            {collections.length > 1 && (
              <section className="space-y-3">
                <SectionHeader title={t("shop.collections")} />
                <div className="grid grid-cols-2 gap-3">
                  {collections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCat(c.id)}
                      className="relative rounded-[var(--radius-card)] overflow-hidden active:scale-[0.98] transition-transform"
                      style={{ height: 110 }}
                    >
                      <Image
                        src={c.image}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 50vw, 220px"
                        className="object-cover"
                        loading="lazy"
                      />
                      <span className="absolute inset-0 bg-black/40 flex items-end p-3">
                        <span className="text-white text-[13px] font-semibold">{c.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {newest.length > 2 && (
              <section className="space-y-3">
                <SectionHeader title={t("shop.newArrivals")} />
                <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {newest.map((p) => (
                    <div key={p.id} className="shrink-0 w-28">
                      <ProductCard
                        product={p}
                        compact
                        onOpen={() => setOpen(p)}
                        onQuickAdd={() => setOpen(p)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <ProductSheet product={open} onClose={() => setOpen(null)} />
    </>
  );
}
