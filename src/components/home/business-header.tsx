import Image from "next/image";
import { MapPin, Phone, AtSign, Store } from "lucide-react";
import type { Business } from "@/lib/data/business";

/**
 * The shop's own masthead: cover, logo, name and the practical details.
 *
 * This is deliberately the first thing on the home screen — the client should
 * feel they're booking with *this* barbershop. The barber's own photo belongs
 * further in, where the question is "who will cut my hair", not "where am I".
 */
export function BusinessHeader({
  business,
  children,
}: {
  business: Business;
  /** Rendered top-right over the cover, e.g. the notification bell. */
  children?: React.ReactNode;
}) {
  const { name, logo_url, cover_url, description, address, phone, instagram } = business;

  return (
    <section className="-mx-4 -mt-[max(20px,var(--safe-top))]">
      {/* Cover */}
      <div className="relative w-full aspect-[16/9] max-h-[210px] bg-surface">
        {cover_url ? (
          <Image
            src={cover_url}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-brand/25 via-surface to-background" />
        )}

        {/* Keeps the logo and name legible over any photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />

        {children && (
          <div className="absolute top-[max(16px,var(--safe-top))] right-4">{children}</div>
        )}
      </div>

      {/* Identity */}
      <div className="px-4 -mt-9 relative">
        <div className="flex items-end gap-3">
          <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden relative shrink-0 bg-surface ring-4 ring-background flex items-center justify-center">
            {logo_url ? (
              <Image src={logo_url} alt={name} fill sizes="72px" className="object-cover" />
            ) : (
              <Store size={28} className="text-brand" />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-[22px] font-extrabold text-foreground leading-tight truncate">
              {name}
            </h1>
            {description && (
              <p className="text-xs text-muted leading-snug line-clamp-2">{description}</p>
            )}
          </div>
        </div>

        {(address || phone || instagram) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
            {address && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted min-w-0">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{address}</span>
              </span>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted"
              >
                <Phone size={12} className="shrink-0" />
                {phone}
              </a>
            )}
            {instagram && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand"
              >
                <AtSign size={12} className="shrink-0" />@{instagram}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
