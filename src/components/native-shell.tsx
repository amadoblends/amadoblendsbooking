"use client";

import { useEffect } from "react";

/**
 * Suppresses the last few browser behaviours CSS can't reach, so a long press
 * never opens "Copiar / Buscar" and a two-finger gesture never zooms the app.
 *
 * Inputs and anything marked `.selectable` are left alone.
 */
export function NativeShell() {
  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      const el = target as HTMLElement | null;
      if (!el?.closest) return false;
      return Boolean(
        el.closest("input, textarea, select, [contenteditable='true'], .selectable")
      );
    }

    function onContextMenu(e: MouseEvent) {
      if (!isEditable(e.target)) e.preventDefault();
    }

    function onGesture(e: Event) {
      e.preventDefault();
    }

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("gesturestart", onGesture);
    document.addEventListener("gesturechange", onGesture);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
    };
  }, []);

  return null;
}
