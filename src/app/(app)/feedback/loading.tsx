import { Skeleton, HeaderSkeleton } from "@/components/ui/skeleton";

/** Two area cards, then the message box — the shape of the real form. */
export default function Loading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6 space-y-5">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-[96px] rounded-[var(--radius-card)]" />
        <Skeleton className="h-[96px] rounded-[var(--radius-card)]" />
      </div>
      <Skeleton className="h-32 w-full rounded-[var(--radius-card)]" />
      <Skeleton className="h-13 w-full" />
    </div>
  );
}
