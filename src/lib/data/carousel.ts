import { createClient } from "@/lib/supabase/server";
import { endOfShopDay, shopDateAt } from "@/lib/timezone";
import type { CarouselPost } from "@/components/home/hero-carousel";

/**
 * The carousel posts the client should see.
 *
 * ── Why this isn't a plain select ────────────────────────────────────────
 * The window columns (`starts_at`, `ends_at`, `is_permanent`) arrive with
 * migration 23. Naming them in a select against a database that hasn't run it
 * yet doesn't return partial data — PostgREST fails the *whole* query, so the
 * carousel went completely empty rather than degrading. That looked like "the
 * client never receives the post".
 *
 * So: ask for the full shape, and if the columns aren't there yet, fall back
 * to the migration-16 shape and derive the window from the date columns. The
 * client keeps working either way; the exact-instant expiry is the only thing
 * that waits for the migration.
 */

const FULL =
  "id, title, description, image_url, type, button_label, button_href, is_active, is_draft, is_permanent, starts_at, ends_at, focal_x, focal_y, zoom";
/** Everything but the framing, for a database without migration 33. */
const WITHOUT_CROP =
  "id, title, description, image_url, type, button_label, button_href, is_active, is_draft, is_permanent, starts_at, ends_at";
const LEGACY =
  "id, title, description, image_url, type, button_label, button_href, is_active, is_draft, starts_on, ends_on";

interface LegacyRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  type: string;
  button_label: string | null;
  button_href: string | null;
  is_active: boolean;
  is_draft: boolean | null;
  starts_on: string | null;
  ends_on: string | null;
}

export async function getCarouselPosts(): Promise<CarouselPost[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("carousel_posts")
    .select(FULL)
    .order("sort_order");

  if (!error && data) return data as unknown as CarouselPost[];

  // Migration 33 (framing) missing but 23 (window) present: the crop simply
  // defaults to centred, which is exactly what it did before.
  const { data: noCrop, error: noCropError } = await supabase
    .from("carousel_posts")
    .select(WITHOUT_CROP)
    .order("sort_order");

  if (!noCropError && noCrop) return noCrop as unknown as CarouselPost[];

  const { data: legacy, error: legacyError } = await supabase
    .from("carousel_posts")
    .select(LEGACY)
    .order("sort_order");

  // No table at all, or something else entirely — an empty carousel is the
  // right answer, and the home screen falls back to its own default slide.
  if (legacyError || !legacy) return [];

  return (legacy as unknown as LegacyRow[]).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    image_url: p.image_url,
    type: p.type,
    button_label: p.button_label,
    button_href: p.button_href,
    is_active: p.is_active,
    is_draft: p.is_draft ?? false,
    // Nothing is permanent before migration 23 introduces the idea
    is_permanent: false,
    starts_at: p.starts_on ? shopDateAt(p.starts_on, "00:00").toISOString() : null,
    // ends_on is inclusive, so the window runs to the end of that day
    ends_at: p.ends_on ? endOfShopDay(p.ends_on).toISOString() : null,
  }));
}
