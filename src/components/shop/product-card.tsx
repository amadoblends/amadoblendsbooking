import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShopProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  /** The line under the name — a short subtitle, not a paragraph. */
  subtitle?: string | null;
  stock?: number | null;
}

/**
 * One product in the grid.
 *
 * ── What the reference actually does ─────────────────────────────────────
 * The photo carries the card. It sits on a soft tinted panel — not white,
 * not a border — so a cutout product has something to stand on, and the row
 * reads as a set rather than as separate boxes. Underneath: name, then a
 * quiet subtitle, then the price. Three lines, no more.
 *
 * The tall 4:5 crop is the thing that makes a grid look composed rather than
 * stacked; a square grid reads as a spreadsheet of pictures. The image
 * itself is `contain`, not `cover`, because a bottle cropped at the neck is
 * worse than a bottle with air around it.
 *
 * Nothing here is oversized: 13px name, 13px price, and the whitespace does
 * the separating instead of padding.
 */
export function ProductCard({
  product,
  href,
  priority,
}: {
  product: ShopProduct;
  href?: string;
  /** Only the first row should preload; the rest arrive as they're scrolled to. */
  priority?: boolean;
}) {
  const soldOut = product.stock !== undefined && product.stock !== null && product.stock <= 0;

  const body = (
    <>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[var(--radius-card)] bg-surface-tint",
          soldOut && "opacity-55"
        )}
        style={{ aspectRatio: "4 / 5" }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            /*
             * Two columns on a phone, so each image is about half the
             * viewport. Telling the browser that is what stops it fetching a
             * 1600px original to fill a 190px box.
             */
            sizes="(max-width: 640px) 50vw, 220px"
            className="object-contain p-3"
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-muted">
            <Package size={26} />
          </span>
        )}

        {soldOut && (
          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-[var(--radius-pill)] bg-surface text-muted">
            Agotado
          </span>
        )}
      </div>

      <div className="pt-2.5">
        <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-1">
          {product.name}
        </p>
        {product.subtitle && (
          <p className="text-[11px] text-muted leading-snug line-clamp-1 mt-0.5">
            {product.subtitle}
          </p>
        )}
        <p className="text-[13px] font-bold text-foreground mt-1 tnum">
          ${Number(product.price).toFixed(2)}
        </p>
      </div>
    </>
  );

  if (!href) return <div>{body}</div>;

  return (
    <Link href={href} className="block active:scale-[0.98] transition-transform">
      {body}
    </Link>
  );
}
