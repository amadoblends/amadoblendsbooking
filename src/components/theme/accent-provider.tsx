"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  ACCENTS,
  ACCENT_KEY,
  DEFAULT_ACCENT,
  accentById,
  applyAccent,
  type Accent,
} from "@/lib/accents";

interface AccentContext {
  accent: Accent;
  setAccent: (id: string) => void;
  all: Accent[];
}

const Ctx = createContext<AccentContext>({
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
  all: ACCENTS,
});

/**
 * Holds the accent while it's still being chosen.
 *
 * Kept in localStorage rather than the database on purpose: this is a
 * decision in progress, not a setting. When one is picked for good it moves
 * into the CSS defaults and this provider comes out — nothing else has to
 * change, because no component ever names a colour.
 *
 * The variables are also written by a blocking script in the layout, so the
 * chosen accent is already on the page before first paint. Doing it here
 * alone would show orange for a frame and then flip.
 */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACCENT_KEY);
    } catch {
      // storage blocked — the default is already applied
    }
    const found = accentById(stored);
    setAccentState(found);
    applyAccent(found, document.documentElement.dataset.theme === "dark");
  }, []);

  const setAccent = useCallback((id: string) => {
    const next = accentById(id);
    setAccentState(next);
    try {
      localStorage.setItem(ACCENT_KEY, next.id);
    } catch {
      // ignore
    }
    applyAccent(next, document.documentElement.dataset.theme === "dark");
  }, []);

  return <Ctx.Provider value={{ accent, setAccent, all: ACCENTS }}>{children}</Ctx.Provider>;
}

export function useAccent(): AccentContext {
  return useContext(Ctx);
}

/**
 * Runs before React, so the stored accent is on the page for the first paint.
 * Without it every load flashes the default for a frame.
 */
export const ACCENT_BOOTSTRAP = `
(function(){try{
var a=localStorage.getItem(${JSON.stringify(ACCENT_KEY)});
if(!a)return;
var m=${JSON.stringify(
  Object.fromEntries(
    ACCENTS.map((a) => [a.id, [a.brand, a.dark, a.light, a.on, a.darkModeLight]])
  )
)};
var v=m[a];if(!v)return;
var d=document.documentElement,dark=d.dataset.theme==='dark';
d.style.setProperty('--color-brand',v[0]);
d.style.setProperty('--color-brand-dark',v[1]);
d.style.setProperty('--color-brand-light',dark?v[4]:v[2]);
d.style.setProperty('--color-brand-on',v[3]);
}catch(e){}})();
`.trim();
