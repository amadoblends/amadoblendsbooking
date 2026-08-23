import { AppointmentListSkeleton, HeaderSkeleton } from "@/components/ui/skeleton";

/** A notification reads like an appointment row: icon, title, line of context. */
export default function Loading() {
  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6 space-y-5">
      <HeaderSkeleton />
      <AppointmentListSkeleton count={5} />
    </div>
  );
}
