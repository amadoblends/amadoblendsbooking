/*
 * ── Why this file is careful about caching ───────────────────────────────
 *
 * A previous version cached page HTML. That is the one thing a Next app must
 * never do: the HTML names the hashed JavaScript and CSS for that exact
 * build, so a stale page pins the whole old app — old design, old code —
 * and keeps pinning it, because the old chunks it names are themselves
 * cached. One flaky moment and the app is frozen on an old deploy with no
 * way for the person to tell.
 *
 * So: hashed assets are cached forever (their names change every build, so
 * they are safe by construction), and everything else always goes to the
 * network. Losing offline browsing is no loss here — an appointment cannot
 * be booked offline anyway.
 */

/*
 * Bumped whenever this file changes. The activate handler deletes every
 * cache that isn't this one, so bumping it wipes the old build's assets
 * instead of letting them accumulate forever.
 */
const CACHE = "amadoblends-v2";

/* Hashed by the build, so a given URL's content can never change. */
const IMMUTABLE_PREFIXES = ["/_next/static/", "/icons/", "/images/"];

self.addEventListener("install", () => {
  // Take over immediately rather than waiting for every tab to close
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;

  /*
   * Cache-first, and safe because the filename contains a content hash: a
   * new build produces new URLs, so a cached entry can never be stale — it
   * simply stops being asked for.
   */
  if (IMMUTABLE_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  /*
   * Everything else — pages, RSC payloads, API calls — goes to the network,
   * every time, and is never stored. This is what guarantees that a deploy
   * is visible on the next load.
   */
});

// ── Push notifications ─────────────────────────────────────────────────────
// The payload arrives encrypted and is decrypted by the browser before it
// reaches here; see src/lib/push/web-push.ts for the sending side.

self.addEventListener("push", (event) => {
  let data = { title: "Amado Blends", body: "", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // A push with no JSON body still deserves to show something
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Same tag replaces an earlier notice about the same appointment
      tag: data.tag || "amadoblends",
      renotify: true,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // Focus an open tab and navigate it rather than opening a duplicate
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
