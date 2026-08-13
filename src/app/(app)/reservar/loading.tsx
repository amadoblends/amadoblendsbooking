import { Skeleton } from "@/components/ui/skeleton";

export default function ReservarLoading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-5">
      <div>
        <Skeleton className="h-7 w-36 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-11 rounded-xl" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
