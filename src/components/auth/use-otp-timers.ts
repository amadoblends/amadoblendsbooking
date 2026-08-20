"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long before a resend is allowed again.
 *
 * Supabase rate-limits the send itself, but a button that looks tappable and
 * then reports "too many attempts" reads as a fault. Counting down says what
 * is actually happening.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * How long a code stays good for.
 *
 * Matches the OTP expiry configured in Supabase (Auth → Providers → Email).
 * Shown rather than enforced here — the server is the authority — so the
 * person knows whether to wait for the email or ask for a fresh code.
 */
export const CODE_LIFETIME_SECONDS = 600;

/** Seconds left until `deadline`, ticking once a second, 0 when unset. */
function useSecondsLeft(deadline: number | null): number {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (deadline === null) {
      setLeft(0);
      return;
    }
    const tick = () => {
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return left;
}

export interface OtpTimers {
  /** Seconds until the resend button becomes available; 0 means ready. */
  resendIn: number;
  /** Seconds until the current code expires; 0 means expired or unsent. */
  expiresIn: number;
  /** True once the code can no longer work. */
  expired: boolean;
  /** Call after a code is successfully sent. */
  markSent: () => void;
  /** Call when leaving the code screen. */
  reset: () => void;
}

/**
 * The two clocks an OTP screen needs: when another code may be requested, and
 * when the current one stops working.
 */
export function useOtpTimers(): OtpTimers {
  const [sentAt, setSentAt] = useState<number | null>(null);
  // Kept so reset() can cancel the timers without waiting for a re-render
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resendIn = useSecondsLeft(
    sentAt === null ? null : sentAt + RESEND_COOLDOWN_SECONDS * 1000
  );
  const expiresIn = useSecondsLeft(
    sentAt === null ? null : sentAt + CODE_LIFETIME_SECONDS * 1000
  );

  const markSent = useCallback(() => setSentAt(Date.now()), []);
  const reset = useCallback(() => setSentAt(null), []);

  return {
    resendIn,
    expiresIn,
    expired: sentAt !== null && expiresIn === 0,
    markSent,
    reset,
  };
}

/** 95 → "1:35", for a countdown that reads like a timer. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}
