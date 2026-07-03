import { Skeleton } from "@/components/ui/skeleton";

export default function CitasLoading() {
  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <Skeleton className="h-7 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}
