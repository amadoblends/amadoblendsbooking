import { Info, Phone } from "lucide-react";
import { getT } from "@/lib/session";

/**
 * What a client sees instead of the booking flow when their account can't
 * take bookings.
 *
 * The wording says nothing about why. The barber's reason for blocking
 * someone is a private note to themselves — repeating it back would turn a
 * business decision into an argument, and it is nobody's business but theirs.
 * A way to get in touch is offered, because the answer might be a mistake.
 */
export async function BookingUnavailable({ phone }: { phone?: string | null }) {
  const { t } = await getT();

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6">
      <div className="bg-surface rounded-2xl border border-border p-6 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-background flex items-center justify-center mx-auto">
          <Info size={24} className="text-muted" />
        </div>
        <div>
          <p className="font-bold text-foreground">{t("blocked.title")}</p>
          <p className="text-sm text-muted mt-1.5 leading-relaxed">{t("blocked.message")}</p>
        </div>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-brand text-white text-sm font-bold"
          >
            <Phone size={15} /> {phone}
          </a>
        )}
      </div>
    </div>
  );
}
