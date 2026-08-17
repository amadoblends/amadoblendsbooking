"use client";

import { useEffect, useState } from "react";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Covers the gap between the first paint and the app being usable.
 *
 * Without it a standalone PWA shows the bare background — a black rectangle —
 * while the session is validated and the first data arrives. That reads as a
 * crash rather than as loading.
 *
 * Deliberately short-lived. It hides as soon as the page has painted rather
 * than waiting on data that can stream in behind it, so it never becomes the
 * thing that makes the app feel slow.
 */
export function AppSplash({ businessName = "Amado Blends" }: { businessName?: string }) {
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // requestAnimationFrame fires after the browser has actually painted, so
    // the splash lifts on real readiness rather than an arbitrary timer.
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        // A beat so the fade is perceptible instead of a flash
        setTimeout(() => setHidden(true), 260);
      });
    });

    // Never let a stuck frame leave the splash up
    const failsafe = setTimeout(() => setHidden(true), 2500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
    };
  }, []);

  // Rendered on the server too, so there's no flash of empty background
  // before hydration.
  if (mounted && hidden) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-4",
        "transition-opacity duration-300",
        hidden ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      <div className="relative">
        <span className="absolute inset-0 rounded-3xl bg-brand/25 blur-xl animate-pulse" />
        <div className="relative w-[72px] h-[72px] rounded-3xl bg-brand flex items-center justify-center shadow-lg shadow-brand/25">
          <Scissors size={32} className="text-white" strokeWidth={2.2} />
        </div>
      </div>

      <div className="text-center">
        <p className="text-lg font-bold text-foreground">{businessName}</p>
        <div className="mt-3 w-24 h-[3px] rounded-full bg-border overflow-hidden mx-auto">
          <span className="block h-full w-1/3 rounded-full bg-brand animate-[splash-sweep_1.1s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
