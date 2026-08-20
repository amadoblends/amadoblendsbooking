"use client";

import { ChevronLeft } from "lucide-react";
import { useAppNavigation } from "@/components/nav/navigation-history";

/**
 * Goes back the way the client actually came.
 *
 * `router.back()` alone walks the whole tab's history, so backing out of the
 * first screen leaves the app entirely. The decision now lives in
 * NavigationHistoryProvider, which records the path as it's walked and lands
 * on the home screen when there's nothing of ours behind.
 */
export function BackButton({ fallback }: { fallback?: string }) {
  const { back } = useAppNavigation();

  return (
    <button
      onClick={() => back(fallback)}
      aria-label="Volver"
      className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 active:bg-background"
    >
      <ChevronLeft size={20} />
    </button>
  );
}
