import { Skeleton, HeaderSkeleton } from "@/components/ui/skeleton";

/** Avatar, then the stack of fields, then the language row. */
export default function Loading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6 space-y-5">
      <HeaderSkeleton />
      <Skeleton className="w-24 h-24 rounded-full mx-auto" />
      <div className="space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}
