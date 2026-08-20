"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cake, Check, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/language-provider";

/** Nobody booking a haircut is under 13, and nobody was born in 1919. */
const DOB_MAX = new Date(Date.now() - 13 * 365.25 * 86_400_000).toISOString().slice(0, 10);
const DOB_MIN = "1920-01-01";

const SNOOZE_KEY = "dobPromptSnoozed.v1";
/** Asked again after this long if they dismiss it. */
const SNOOZE_MS = 7 * 24 * 3600_000;

/**
 * Asks an existing client for the one thing their account is missing.
 *
 * Registration requires a birth date now, but the clients who signed up
 * before it did don't have one — and their accounts must keep working. So
 * this is a card on the home screen, not a gate: it can be dismissed, it
 * comes back in a week, and once the date is saved it never appears again
 * because the server stops rendering it.
 */
export function CompleteBirthDate({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { t } = useT();
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // storage blocked — it simply asks again next visit
    }
    setHidden(true);
  }

  async function save() {
    if (!dob) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase
      .from("clients")
      .update({ birth_date: dob })
      .eq("id", clientId);

    setSaving(false);
    if (err) {
      setError(t("profile.dobFailed"));
      return;
    }
    // The card disappears because the server no longer renders it
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-light text-brand flex items-center justify-center shrink-0">
          <Cake size={17} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">{t("profile.completeTitle")}</p>
          <p className="text-xs text-muted mt-0.5">{t("profile.completeDob")}</p>
        </div>
        <button
          onClick={snooze}
          aria-label={t("common.later")}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted shrink-0"
        >
          <X size={15} />
        </button>
      </div>

      <input
        type="date"
        value={dob}
        min={DOB_MIN}
        max={DOB_MAX}
        onChange={(e) => setDob(e.target.value)}
        className="w-full h-12 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
      />

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={snooze}
          className="flex-1 h-10 rounded-xl border border-border bg-background text-xs font-bold text-muted"
        >
          {t("common.later")}
        </button>
        <button
          onClick={save}
          disabled={!dob || saving}
          className="flex-1 h-10 rounded-xl bg-brand text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
