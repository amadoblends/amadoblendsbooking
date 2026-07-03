import { Skeleton } from "@/components/ui/skeleton";

export default function TiendaLoading() {
  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <div>
        <Skeleton className="h-7 w-24 mb-2" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
