import { Skeleton, HeaderSkeleton } from "@/components/ui/skeleton";

/** The guest form: who it's for, then their details. */
export default function Loading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6 space-y-5">
      <HeaderSkeleton />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-13 w-full" />
    </div>
  );
}
