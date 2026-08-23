"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, and makes sure it can be replaced.
 *
 * ── The bug this fixes ───────────────────────────────────────────────────
 * `register()` on its own is not enough. The browser only re-checks sw.js on
 * its own schedule — and caches sw.js itself for up to a day — so an
 * installed app can keep running an old worker long after a deploy. Combined
 * with a worker that cached HTML, that meant the app could sit on an old
 * build indefinitely with nothing on screen to say so.
 *
 * Two things fix it: ask for an update on every load and when the app comes
 * back to the foreground, and reload once the new worker takes control.
 */
export function SwRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        // Ask straight away rather than waiting for the browser's own timer
        reg.update().catch(() => {});
      })
      .catch(() => {
        // No service worker is a working app, just without offline assets
      });

    /*
     * A new worker calling skipWaiting() ends up controlling this page
     * mid-session, at which point the page and the code it's running come
     * from different builds. One reload settles it.
     */
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Reopening the app is the moment a person expects it to be current
    const onVisible = () => {
      if (document.visibilityState === "visible") registration?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
