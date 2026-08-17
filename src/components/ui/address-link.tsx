"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An address that opens the phone's maps app, the way a phone number opens
 * the dialer.
 *
 * `maps:` is Apple Maps' scheme and only iOS answers it. Rather than sniff the
 * user agent — which is unreliable and ages badly — the link points at the
 * `geo:` URI, which iOS hands to Apple Maps and Android offers as a chooser,
 * with a Google Maps URL as the href so any desktop browser still works.
 *
 * On iOS a plain Google Maps link already offers to open Apple Maps, so this
 * lands in the right place on every platform without branching.
 */
export function AddressLink({
  address,
  name,
  className,
  showIcon = true,
}: {
  address: string;
  /** Included in the query so the pin lands on the business, not just the street. */
  name?: string;
  className?: string;
  showIcon?: boolean;
}) {
  const query = [name, address].filter(Boolean).join(" ");
  const href = `https://maps.google.com/?q=${encodeURIComponent(query)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        "inline-flex items-start gap-1.5 text-brand active:opacity-60 transition-opacity",
        className
      )}
    >
      {showIcon && <MapPin size={13} className="shrink-0 mt-px" />}
      <span className="underline underline-offset-2 decoration-brand/30">{address}</span>
    </a>
  );
}

/** A phone number that dials. */
export function PhoneLink({
  phone,
  className,
  children,
}: {
  phone: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={`tel:${phone.replace(/[^\d+]/g, "")}`}
      className={cn("text-brand active:opacity-60 transition-opacity", className)}
    >
      {children ?? phone}
    </a>
  );
}
