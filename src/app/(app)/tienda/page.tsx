import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ShoppingBag, Package } from "lucide-react";
import Image from "next/image";
import { BackButton } from "@/components/ui/back-button";
import { RealtimeRefresher } from "@/components/realtime/realtime-refresher";

export default async function TiendaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, stock, image_url")
    .gt("stock", 0)
    .eq("is_visible_for_sale", true)
    .order("name");

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <RealtimeRefresher tables={["products"]} />
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Tienda</h1>
          <p className="text-sm text-muted">Productos profesionales para tu mejor versión</p>
        </div>
      </header>

      {!products || products.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center space-y-2">
          <Package size={32} className="text-muted mx-auto" />
          <p className="text-sm text-muted">Pronto tendremos productos disponibles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-surface rounded-2xl border border-border overflow-hidden"
            >
              {p.image_url ? (
                <div className="w-full aspect-square">
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    width={300}
                    height={300}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full aspect-square bg-brand-light flex items-center justify-center">
                  <ShoppingBag size={32} className="text-brand/50" />
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-semibold text-foreground leading-tight">{p.name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-base font-bold text-brand">${p.price}</p>
                  {p.stock <= 3 && (
                    <span className="text-[10px] text-warning font-semibold">
                      ¡Quedan {p.stock}!
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-brand-light rounded-xl p-3 border border-brand/20">
        <p className="text-xs text-brand font-semibold">
          🛍️ Los productos se compran directamente en el local durante tu visita.
        </p>
      </div>
    </div>
  );
}
