import { Skeleton } from "@/components/ui/skeleton";

export default function PerfilLoading() {
  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-12 rounded-xl" />
    </div>
  );
}
