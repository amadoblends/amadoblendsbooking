import { cn } from "@/lib/utils";

/**
 * The shapes shown while real content is on its way.
 *
 * ── The rule these follow ────────────────────────────────────────────────
 * A skeleton has to be the same shape as what replaces it. A generic grey
 * box is worse than nothing: the layout jumps when the real thing lands, and
 * the jump reads as slowness even when the wait was short. Each skeleton
 * here mirrors one specific component, at its real height.
 *
 * And a skeleton is not a fix for a slow screen. It's what a legitimate wait
 * should look like — the actual work of being fast happens elsewhere.
 */

/** One shimmering block. Everything else here is built from these. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("bg-surface-tint animate-pulse rounded-[var(--radius-control)]", className)}
      style={style}
    />
  );
}

/** A row of stat tiles, as on the dashboard and the profile. */
export function StatsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3", count === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-[var(--radius-card)] border border-border p-4 space-y-2"
        >
          <Skeleton className="w-5 h-5 rounded-full mx-auto" />
          <Skeleton className="h-6 w-12 mx-auto" />
          <Skeleton className="h-3 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}

/**
 * The product and service grid.
 *
 * Two columns with a tall image area, because that's what the real card is —
 * a photo doing the work with the name and price beneath it.
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-full rounded-[var(--radius-card)]" style={{ aspectRatio: "4 / 5" }} />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** The horizontal category pills above a grid. */
export function CategoriesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[62px] w-[68px] shrink-0 rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}

/** A list of appointments, as on Mis citas. */
export function AppointmentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-[var(--radius-card)] border border-border p-4 flex items-center gap-3"
        >
          <Skeleton className="w-11 h-11 rounded-[var(--radius-control)] shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The bookable times, which arrive after the day is chosen. */
export function TimeSlotsSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}

/** The hero carousel at the top of the client's home. */
export function CarouselSkeleton() {
  return <Skeleton className="w-full rounded-[var(--radius-card)]" style={{ height: 168 }} />;
}

/** A page header: title over a line of context. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-3.5 w-56" />
    </div>
  );
}
