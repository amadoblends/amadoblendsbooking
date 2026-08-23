import { Skeleton, HeaderSkeleton } from "@/components/ui/skeleton";

/** Mirrors the appointment detail: header, the big summary card, then actions. */
export default function Loading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6 space-y-5">
      <HeaderSkeleton />
      <Skeleton className="w-full h-40 rounded-[var(--radius-card)]" />
      <div className="space-y-2.5">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
