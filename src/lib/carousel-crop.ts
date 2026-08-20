/**
 * Where an image sits inside a carousel slide.
 *
 * The file itself is never cut. What's stored is which part shows: a focal
 * point as a percentage and a zoom relative to "just covers". That keeps the
 * original intact, lets the framing be changed later without re-uploading,
 * and costs nothing in quality — the browser is doing the same `cover` it
 * always did, just told where to look.
 */

export interface CarouselCrop {
  /** The point kept centred, 0–100. 50/50 is the old centre-cover default. */
  focal_x: number;
  focal_y: number;
  /** 1 = exactly covers the frame. Above that, zoomed in. */
  zoom: number;
}

export const DEFAULT_CROP: CarouselCrop = { focal_x: 50, focal_y: 50, zoom: 1 };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * The slide's shape, measured from the real thing: full content width on an
 * iPhone (430px screen less the 16px page padding either side) against the
 * slide's 168px minimum height.
 */
export const SLIDE_ASPECT = 398 / 168;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Keeps a crop inside the range the database will accept.
 *
 * Takes nulls as well as undefined, because that is what a database row hands
 * back for a column added by a migration that hasn't run yet.
 */
export function normalizeCrop(
  crop: Partial<Record<keyof CarouselCrop, number | null | undefined>> | null | undefined
): CarouselCrop {
  if (!crop) return DEFAULT_CROP;
  return {
    focal_x: clamp(Number(crop.focal_x ?? 50), 0, 100),
    focal_y: clamp(Number(crop.focal_y ?? 50), 0, 100),
    zoom: clamp(Number(crop.zoom ?? 1), MIN_ZOOM, MAX_ZOOM),
  };
}

/**
 * The CSS that renders a crop.
 *
 * One function so the editor's preview and the client's carousel can't drift:
 * whatever the preview shows is literally the same declaration the client
 * receives.
 */
export function cropStyle(crop: CarouselCrop): {
  backgroundSize: string;
  backgroundPosition: string;
} {
  const pct = Math.round(crop.zoom * 100);
  return {
    // "cover" scaled up by the zoom, so 1 stays exactly the old behaviour
    backgroundSize: crop.zoom <= 1 ? "cover" : `${pct}% auto`,
    backgroundPosition: `${crop.focal_x}% ${crop.focal_y}%`,
  };
}

/**
 * Converts a drag into a new focal point.
 *
 * Dragging moves the *image*, so the focal point moves the opposite way — the
 * part you pull towards the middle is the part that ends up centred. The
 * further in you are zoomed, the less a given pixel moves the framing, which
 * is what makes fine adjustment possible at high zoom.
 */
export function panCrop(
  crop: CarouselCrop,
  dxPx: number,
  dyPx: number,
  frameWidth: number,
  frameHeight: number
): CarouselCrop {
  if (frameWidth <= 0 || frameHeight <= 0) return crop;
  const scale = Math.max(1, crop.zoom);

  return {
    ...crop,
    focal_x: clamp(crop.focal_x - (dxPx / frameWidth) * (100 / scale), 0, 100),
    focal_y: clamp(crop.focal_y - (dyPx / frameHeight) * (100 / scale), 0, 100),
  };
}
