import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
      <div>
        <Skeleton className="h-7 w-44 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-[168px] rounded-3xl" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
