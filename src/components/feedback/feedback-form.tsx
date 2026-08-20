"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Smartphone, Scissors, Check, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/language-provider";
import { categoriesFor } from "@/lib/feedback-categories";

type Area = "app" | "service";

/**
 * The client's feedback box, split in two because the two kinds go to
 * different places in the barber's head: a bug in the app is not the same
 * complaint as a haircut that went wrong, and mixing them makes both easier
 * to ignore.
 */
export function FeedbackForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { t, lang } = useT();
  const [area, setArea] = useState<Area | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit() {
    if (!area || !category || message.trim().length < 3) return;
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.from("feedback").insert({
      client_id: clientId,
      area,
      category,
      message: message.trim(),
      // Rating only makes sense for the service itself
      rating: area === "service" ? rating : null,
    });

    if (err) {
      setError(t("feedback.failed"));
      return;
    }
    setSent(true);
    startTransition(() => router.refresh());
  }

  if (sent) {
    return (
      <div className="bg-success-light border border-success/25 rounded-2xl p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center mx-auto">
          <Check size={24} className="text-white" strokeWidth={3} />
        </div>
        <div>
          <p className="font-bold text-foreground">{t("feedback.thanks")}</p>
          <p className="text-sm text-muted mt-1">{t("feedback.thanksHint")}</p>
        </div>
        <button
          onClick={() => {
            setSent(false);
            setArea(null);
            setCategory(null);
            setMessage("");
            setRating(null);
          }}
          className="text-xs font-bold text-success"
        >
          {t("feedback.sendAnother")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">{t("feedback.about")}</p>
        <div className="grid grid-cols-2 gap-2">
          <AreaButton
            active={area === "service"}
            onClick={() => {
              setArea("service");
              setCategory(null);
            }}
            icon={<Scissors size={20} />}
            label={t("feedback.areaService")}
            hint={t("feedback.areaServiceHint")}
          />
          <AreaButton
            active={area === "app"}
            onClick={() => {
              setArea("app");
              setCategory(null);
            }}
            icon={<Smartphone size={20} />}
            label={t("feedback.areaApp")}
            hint={t("feedback.areaAppHint")}
          />
        </div>
      </div>

      {area && (
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">{t("feedback.category")}</p>
          <div className="grid grid-cols-2 gap-2">
            {categoriesFor(area).map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={cn(
                  "h-11 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98]",
                  category === c.value
                    ? "border-brand bg-brand-light text-brand"
                    : "border-border bg-surface text-foreground"
                )}
              >
                <span aria-hidden>{c.emoji}</span>
                {lang === "en" ? c.en : c.es}
              </button>
            ))}
          </div>
        </div>
      )}

      {area === "service" && (
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">{t("feedback.rating")}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n}`}
                className="flex-1 h-12 rounded-xl border border-border bg-background flex items-center justify-center active:scale-95 transition-transform"
              >
                <Star
                  size={20}
                  className={cn(
                    rating !== null && n <= rating
                      ? "text-brand fill-brand"
                      : "text-muted"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {area && category && (
        <div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={1000}
            autoFocus
            placeholder={
              area === "app" ? t("feedback.placeholderApp") : t("feedback.placeholderService")
            }
            className="w-full p-3.5 rounded-xl border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-brand placeholder:text-muted"
          />
          <p className="text-[11px] text-muted text-right mt-1">{message.length}/1000</p>
        </div>
      )}

      {error && <p className="text-sm text-danger text-center">{error}</p>}

      <button
        onClick={submit}
        disabled={!area || !category || message.trim().length < 3 || isPending}
        className="w-full h-13 py-4 rounded-2xl bg-brand text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {isPending ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <MessageSquare size={16} />
        )}
        {t("feedback.send")}
      </button>
    </div>
  );
}

function AreaButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-3.5 text-left transition-colors active:scale-[0.98]",
        active ? "border-brand bg-brand-light" : "border-border bg-surface"
      )}
    >
      <span className={cn("block mb-2", active ? "text-brand" : "text-muted")}>{icon}</span>
      <span className="block text-sm font-bold text-foreground">{label}</span>
      <span className="block text-[11px] text-muted leading-tight mt-0.5">{hint}</span>
    </button>
  );
}
