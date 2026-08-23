"use client";

import { forwardRef, useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-[var(--color-brand-on)] active:bg-brand-dark",
  secondary: "bg-surface border border-border text-foreground active:bg-background",
  ghost: "text-muted active:bg-surface",
  danger: "bg-danger text-white active:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs rounded-[var(--radius-control)]",
  md: "h-11 px-5 text-sm rounded-[var(--radius-control)]",
  lg: "h-13 px-6 text-sm rounded-[var(--radius-control)]",
};

/**
 * A button that answers the moment it's pressed.
 *
 * ── What this exists to prevent ──────────────────────────────────────────
 * Tap → nothing → two seconds → something. The screen looks dead, so the
 * button gets pressed again, and now the appointment is booked twice.
 *
 * So: the press is acknowledged in the same frame (the scale), the spinner
 * replaces the icon rather than appearing beside it so the label never
 * shifts, and the button disables itself for the whole of the work.
 *
 * `onClick` may return a promise. If it does, the loading state lasts
 * exactly as long as the promise — no caller has to remember to set and
 * unset a flag, which is where double-submits come from.
 */
export const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    onClick?: () => void | Promise<unknown>;
    children: React.ReactNode;
    variant?: Variant;
    size?: Size;
    /** Shown while the work is in flight, instead of `children`. */
    busyLabel?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    /** Forces the loading state when the caller owns it. */
    loading?: boolean;
    type?: "button" | "submit";
    className?: string;
    full?: boolean;
  }
>(function ActionButton(
  {
    onClick,
    children,
    variant = "primary",
    size = "md",
    busyLabel,
    icon,
    disabled,
    loading,
    type = "button",
    className,
    full,
  },
  ref
) {
  const [running, setRunning] = useState(false);
  // Guards the gap between the tap and React re-rendering as disabled, where
  // a fast second tap would otherwise get through
  const inFlight = useRef(false);

  const busy = loading || running;

  const handle = useCallback(async () => {
    if (!onClick || inFlight.current) return;
    const result = onClick();
    // A synchronous handler needs no spinner at all
    if (!(result instanceof Promise)) return;

    inFlight.current = true;
    setRunning(true);
    try {
      await result;
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  }, [onClick]);

  return (
    <button
      ref={ref}
      type={type}
      onClick={handle}
      disabled={disabled || busy}
      aria-busy={busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold",
        "transition-transform active:scale-[0.97]",
        "disabled:opacity-50 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className
      )}
    >
      {busy ? <Loader2 size={16} className="animate-spin shrink-0" /> : icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
});
