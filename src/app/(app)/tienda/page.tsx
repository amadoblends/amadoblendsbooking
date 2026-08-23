import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";
import { ShopView, type ShopItem } from "@/components/shop/shop-view";
import { getT } from "@/lib/session";
import { DEFAULT_CATEGORIES, categoryLabel } from "@/lib/product-categories";

export default async function TiendaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { t, lang } = await getT();

  /*
   * Only the columns the grid draws. The old query also pulled `description`
   * and `purchase_url` for every product, which the card never showed —
   * description in particular can be long, and it was being downloaded for
   * the whole catalogue to render a name and a price.
   */
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, price, stock, image_url, category, description, purchase_url, created_at, units_sold"
    )
    .gt("stock", 0)
    .eq("is_visible_for_sale", true)
    .order("name");

  const items: ShopItem[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    image_url: p.image_url,
    stock: p.stock,
    category: p.category ?? null,
    description: p.description ?? null,
    purchase_url: p.purchase_url ?? null,
    created_at: p.created_at,
    units_sold: Number(p.units_sold ?? 0),
  }));

  // Only categories that actually have something in them
  const present = new Set(items.map((i) => i.category).filter(Boolean) as string[]);
  const categories = DEFAULT_CATEGORIES.filter((c) => present.has(c.id)).map((c) => ({
    id: c.id,
    label: categoryLabel(c.id, lang),
  }));

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-5">
      <RealtimeRefresher tables={["products"]} />

      {/* The serif name, as on the home screen — this is a top-level tab */}
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[26px] text-foreground leading-none">
          {t("shop.title")}
        </h1>
      </header>

      <ShopView products={items} categories={categories} />
    </div>
  );
}
