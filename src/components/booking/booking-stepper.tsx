"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Where you are in the booking, and how much is left.
 *
 * ── What it's for ────────────────────────────────────────────────────────
 * A booking is the one flow in this app with more than two screens, and the
 * question it has to answer is "how much more of this is there". Four dots
 * with a connecting line answer it at a glance; a bare title doesn't.
 *
 * Completed steps become a tick and stay tappable — going back to change the
 * service is a normal thing to do, and forcing a restart to do it is what
 * makes people abandon a booking. Steps ahead are dimmed and inert, because
 * skipping to "Confirm" with no service chosen isn't a state that exists.
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
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = done && onGoTo;

        return (
          <li key={s.id} className="flex-1 flex flex-col items-center relative">
            {/*
              * The connector is drawn behind, from this dot to the next, and
              * is filled only for the stretch already walked.
              */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-[15px] left-1/2 w-full h-px",
                  done ? "bg-brand" : "bg-border"
                )}
              />
            )}

            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onGoTo(i)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative z-10 w-[31px] h-[31px] rounded-full flex items-center justify-center",
                "transition-colors shrink-0",
                active && "bg-brand text-[var(--color-brand-on)]",
                done && "bg-brand text-[var(--color-brand-on)]",
                !active && !done && "bg-surface border border-border text-muted",
                reachable && "active:scale-90"
              )}
            >
              {done ? <Check size={15} strokeWidth={3} /> : s.icon}
            </button>

            <span
              className={cn(
                "text-[10px] font-semibold mt-1.5 text-center leading-tight px-0.5 line-clamp-1",
                active || done ? "text-foreground" : "text-muted"
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
