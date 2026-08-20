"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY = "navStack.v1";
/** Deep enough for any real journey; stops one tab growing without bound. */
const MAX_DEPTH = 40;

interface NavHistory {
  /** Screens behind this one, oldest first. Excludes the current screen. */
  depth: number;
  /** Where Back would land, or null when there's nothing of ours behind. */
  previous: string | null;
  /** `fallback` only applies when nothing of ours is behind this screen. */
  back: (fallback?: string) => void;
}

/*
 * The default is only reached by a screen rendered outside the provider.
 * It degrades to the browser's own Back rather than to a dead button, so a
 * page added outside the layout later is merely less precise, not broken.
 */
const NavContext = createContext<NavHistory>({
  depth: 0,
  previous: null,
  back: (fallback) => {
    if (typeof window === "undefined") return;
    if (window.history.length > 1) window.history.back();
    else window.location.assign(fallback ?? "/");
  },
});

function read(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(stack: string[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(stack.slice(-MAX_DEPTH)));
  } catch {
    // Private mode or storage full — Back falls back to the dashboard
  }
}

/**
 * Tracks the route path actually walked inside the app.
 *
 * ── Why not just router.back() ───────────────────────────────────────────
 * The browser's history is the whole tab's, not ours: it holds whatever was
 * open before the app, so backing out of the first screen leaves the app
 * entirely. The old check tried to tell the two apart with
 * `document.referrer`, but Next sets no referrer on a client-side navigation,
 * so it read as "came from outside" or "came from inside" almost at random.
 *
 * So the path is recorded as it's walked, in sessionStorage — per tab, and it
 * survives a reload. Back is then answerable exactly: pop one entry, and when
 * there is nothing of ours left, go to the dashboard rather than out of the
 * app.
 *
 * A → B → A is stored as three entries, so Back from the second A goes to B,
 * as it should. Only an actual back step pops, which is how the stack stays
 * honest without ever sending you into a loop.
 */
export function NavigationHistoryProvider({
  children,
  home = "/",
}: {
  children: React.ReactNode;
  /** Where Back goes when nothing of ours is behind. */
  home?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [stack, setStack] = useState<string[]>([]);
  // Set while a Back we initiated is in flight, so the resulting route change
  // isn't mistaken for a new forward navigation
  const popping = useRef(false);
  /*
   * Set by the browser's own Back/Forward. Without it, a step back is
   * indistinguishable from navigating to a screen you happen to have visited
   * before: A → B → A looks exactly like backing out of B, and the stack
   * would collapse, sending the next Back two screens too far.
   */
  const cameFromPopstate = useRef(false);

  useEffect(() => {
    const onPop = () => {
      cameFromPopstate.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const current = read();

    const viaPopstate = cameFromPopstate.current;
    cameFromPopstate.current = false;

    if (popping.current) {
      popping.current = false;
      // The pop already happened in back(); nothing more to record
      setStack(current);
      return;
    }

    // Re-entering the same screen isn't a navigation
    if (current[current.length - 1] === pathname) {
      setStack(current);
      return;
    }

    /*
     * A step back only shortens the stack when the browser actually went
     * back. Matching on the path alone would collapse A → B → A, because
     * arriving at A the second time looks identical to backing out of B.
     */
    if (viaPopstate && current.length >= 2 && current[current.length - 2] === pathname) {
      const next = current.slice(0, -1);
      write(next);
      setStack(next);
      return;
    }

    const next = [...current, pathname];
    write(next);
    setStack(next);
  }, [pathname]);

  const back = useCallback(
    (fallback?: string) => {
      const current = read();

      // Nothing of ours behind this screen — land somewhere real
      if (current.length <= 1) {
        const target = fallback ?? home;
        write([target]);
        setStack([target]);
        router.push(target);
        return;
      }

      const next = current.slice(0, -1);
      write(next);
      setStack(next);
      popping.current = true;

      /*
       * router.back() rather than push(previous): it's the same destination,
       * but it restores the scroll position and doesn't pile a forward entry
       * onto the browser's history.
       */
      router.back();
    },
    [router, home]
  );

  const value: NavHistory = {
    depth: Math.max(0, stack.length - 1),
    previous: stack.length >= 2 ? stack[stack.length - 2] : null,
    back,
  };

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

/** `const { back, previous } = useAppNavigation()`. */
export function useAppNavigation(): NavHistory {
  return useContext(NavContext);
}
