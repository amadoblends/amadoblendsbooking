"use client";

import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
}

/**
 * Where you are in the booking, and how much is left.
 *
 * ── What it's for ────────────────────────────────────────────────────────
 * A booking is the one flow here with more than two screens, and the
 * question it has to answer is "how much more of this is there". Numbered
 * circles joined by a line answer it at a glance; a bare title doesn't.
 *
 * Completed steps become a tick and stay tappable — going back to change the
 * service is a normal thing to do, and forcing a restart to do it is what
 * makes people abandon a booking. Steps ahead are inert, because reaching
 * "Confirm" with no service chosen isn't a state that exists.
 *
 * ── About the missing "Staff" step ───────────────────────────────────────
 * The design has four steps because it was drawn for a shop with three
 * barbers. There is one. A step whose only option is already chosen is a
 * screen that exists to be tapped past, so it isn't here — and because the
 * steps are a plain array, putting it back when there's a second barber is
 * one entry.
 */
export function BookingStepper({
  steps,
  current,
  onGoTo,
}: {
  steps: Step[];
  /** Index of the step being shown. */
  current: number;
  /** Only ever called for a step already completed. */
  onGoTo?: (index: number) => void;
}) {
  return (
    <ol className="flex items-start gap-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = done && onGoTo;

        return (
          <li key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && onGoTo(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center",
                  "text-[11px] font-bold transition-colors shrink-0",
                  done || active
                    ? "bg-brand text-[var(--color-brand-on)]"
                    : "bg-surface-tint text-muted",
                  reachable && "active:scale-90"
                )}
              >
                {done ? "✓" : i + 1}
              </button>
              <span
                className={cn(
                  "text-[9px] mt-1 font-medium text-center leading-tight",
                  active ? "text-brand" : "text-muted"
                )}
              >
                {s.label}
              </span>
            </div>

            {/* Filled only for the stretch already walked */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn("h-px flex-1 mb-4", done ? "bg-brand" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
