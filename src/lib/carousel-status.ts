/**
 * The one place that decides whether a carousel post reaches a client.
 *
 * Status is *derived*, never stored: a stored status drifts out of step the
 * moment a clock passes an end date with nobody watching. Everything follows
 * from three fields plus the current instant, so the same post can be asked
 * again a second later and correctly change from active to expired.
 *
 * Shared verbatim by both apps — the barber's panel and the client's carousel
 * must agree on what "finalizada" means.
 */

export type CarouselStatus =
  | "draft"      // written but never published
  | "scheduled"  // published, but its start hasn't arrived
  | "active"     // live right now
  | "paused"     // published then switched off by the barber
  | "expired"    // its end has passed
  | "permanent"; // brand content, shown only when nothing else is active

export interface WindowedPost {
  is_active: boolean;
  is_draft?: boolean | null;
  is_permanent?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
}

export const STATUS_LABEL: Record<CarouselStatus, { es: string; en: string }> = {
  draft: { es: "Borrador", en: "Draft" },
  scheduled: { es: "Programada", en: "Scheduled" },
  active: { es: "Activa", en: "Active" },
  paused: { es: "Pausada", en: "Paused" },
  expired: { es: "Finalizada", en: "Expired" },
  permanent: { es: "Permanente", en: "Permanent" },
};

/**
 * Order matters: a draft is a draft even if its dates have passed, and a
 * paused post is paused rather than expired, because the barber can switch it
 * back on.
 */
export function carouselStatus(post: WindowedPost, now: number = Date.now()): CarouselStatus {
  if (post.is_draft) return "draft";
  if (!post.is_active) return "paused";
  if (post.is_permanent) return "permanent";

  const start = post.starts_at ? Date.parse(post.starts_at) : null;
  const end = post.ends_at ? Date.parse(post.ends_at) : null;

  if (start !== null && now < start) return "scheduled";
  // No end date means the barber never said when it stops. Treating that as
  // "forever" is what kept a finished vacation notice on screen, so it counts
  // as expired the moment anything else is available.
  if (end === null) return "expired";
  if (now >= end) return "expired";
  return "active";
}

/** Only these reach the client's carousel as real content. */
export function isLive(post: WindowedPost, now: number = Date.now()): boolean {
  return carouselStatus(post, now) === "active";
}

export function isPermanent(post: WindowedPost, now: number = Date.now()): boolean {
  return carouselStatus(post, now) === "permanent";
}

/**
 * What the carousel should show right now.
 *
 * Live content wins. When nothing is live the permanent brand content takes
 * over — never a post that has already finished.
 */
export function visiblePosts<T extends WindowedPost>(posts: T[], now: number = Date.now()): T[] {
  const live = posts.filter((p) => isLive(p, now));
  if (live.length > 0) return live;
  return posts.filter((p) => isPermanent(p, now));
}

/**
 * The next instant at which any post's status changes, so a running app can
 * schedule exactly one timer instead of polling.
 */
export function nextTransitionAt(posts: WindowedPost[], now: number = Date.now()): number | null {
  let soonest: number | null = null;
  for (const p of posts) {
    if (p.is_draft || !p.is_active) continue;
    for (const iso of [p.starts_at, p.ends_at]) {
      if (!iso) continue;
      const t = Date.parse(iso);
      if (Number.isNaN(t) || t <= now) continue;
      if (soonest === null || t < soonest) soonest = t;
    }
  }
  return soonest;
}
