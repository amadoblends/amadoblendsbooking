"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/language-provider";
import { shopShortDate } from "@/lib/timezone";

export interface AwaitingVisit {
  appointment_id: string;
  starts_at: string;
  service_name: string | null;
}

const DISMISSED_KEY = "rateVisitDismissed.v1";

/**
 * Asking how the visit went, right after the visit.
 *
 * ── Why here and not in the profile ──────────────────────────────────────
 * The feedback screen already accepts a star rating, but nobody goes looking
 * for it, and stars given cold aren't about anything in particular — they
 * can't be tied to a service or a day. Asked on the home screen a day after
 * the haircut, the question is concrete and the answer is worth something.
 *
 * One tap on a star sends it. Anything more — a comment box, a "submit"
 * button — is more than the moment deserves, and the note is offered only
 * after the rating is already safe.
 *
 * It asks about one visit, never a backlog: four rating prompts in a row get
 * none of them answered.
 */
export function RateVisit({ visit, clientId }: { visit: AwaitingVisit; clientId: string }) {
  const router = useRouter();
  const { t } = useT();
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(DISMISSED_KEY) === visit.appointment_id;
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  function dismiss() {
    // Remembered per appointment, so the next visit still gets asked
    try {
      localStorage.setItem(DISMISSED_KEY, visit.appointment_id);
    } catch {
      // storage blocked — it simply asks again next time
    }
    setHidden(true);
  }

  async function send(stars: number, withNote = "") {
    setError(null);
    setRating(stars);

    const supabase = createClient();
    const { error: err } = await supabase.from("feedback").insert({
      client_id: clientId,
      appointment_id: visit.appointment_id,
      area: "service",
      category: "service",
      rating: stars,
      // The message is required, so a bare rating says what it is
      message: withNote.trim() || `${stars}/5`,
    });

    if (err) {
      setError(t("feedback.failed"));
      setRating(null);
      return;
    }
    setSent(true);
    startTransition(() => router.refresh());
  }

  if (sent) {
    return (
      <div className="bg-success-light border border-success/25 rounded-2xl p-4 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-success flex items-center justify-center shrink-0">
          <Check size={18} className="text-white" strokeWidth={3} />
        </span>
        <p className="text-sm font-bold text-foreground">{t("feedback.thanks")}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{t("rate.title")}</p>
          <p className="text-xs text-muted">
            {visit.service_name ?? t("booking.service")} · {shopShortDate(visit.starts_at)}
          </p>
        </div>
        <button
          onClick={dismiss}
          aria-label={t("common.later")}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex gap-1.5" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const lit = (hovered ?? rating ?? 0) >= n;
          return (
            <button
              key={n}
              type="button"
              disabled={isPending || rating !== null}
              onMouseEnter={() => setHovered(n)}
              onClick={() => send(n)}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              className="flex-1 h-12 rounded-xl border border-border bg-background flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
            >
              <Star
                size={22}
                className={cn(lit ? "text-brand fill-brand" : "text-muted")}
              />
            </button>
          );
        })}
      </div>

      {/* Offered only once the rating is already safely recorded */}
      {rating !== null && !sent && (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t("rate.notePlaceholder")}
            className="w-full p-3 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
          />
          <button
            onClick={() => send(rating, note)}
            disabled={isPending}
            className="w-full h-10 rounded-xl bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5"
          >
            {isPending && <Loader2 size={13} className="animate-spin" />}
            {t("feedback.send")}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <p className="text-[11px] text-muted/70">{t("rate.privateHint")}</p>
    </div>
  );
}
