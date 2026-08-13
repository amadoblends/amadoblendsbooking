import Image from "next/image";
import { MapPin, Phone, AtSign, Store } from "lucide-react";
import { cn } from "@/lib/utils";
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
      {/*
        * With a cover photo this is a proper masthead. Without one it
        * collapses to just enough height to clear the Dynamic Island and hold
        * the bell — reserving a 16:9 block of empty gradient wasted a third of
        * the screen on phones that had no cover set.
        */}
      <div
        className={cn(
          "relative w-full bg-surface",
          cover_url ? "aspect-[16/9] max-h-[200px]" : "h-[calc(var(--safe-top)+56px)]"
        )}
      >
        {cover_url ? (
          <>
            <Image src={cover_url} alt="" fill priority sizes="100vw" className="object-cover" />
            {/* Keeps the logo and name legible over any photo */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/45 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-brand/12 to-background" />
        )}

        {children && (
          <div className="absolute top-[max(12px,var(--safe-top))] right-4">{children}</div>
        )}
      </div>

      {/* Identity */}
      <div className={cn("px-4 relative", cover_url ? "-mt-9" : "-mt-6")}>
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
