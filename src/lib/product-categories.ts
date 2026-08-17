/**
 * Product categories.
 *
 * The database owns the list (migration 27's `product_categories` table) so a
 * new one is an insert, not a deploy. These are the seeded defaults, used for
 * labels when a screen doesn't fetch the table and as the fallback if it
 * hasn't been created yet.
 */

export interface ProductCategory {
  id: string;
  label_es: string;
  label_en: string;
  emoji: string | null;
  sort_order: number;
}

export const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: "hair", label_es: "Pelo", label_en: "Hair", emoji: "💇", sort_order: 10 },
  { id: "face", label_es: "Facial", label_en: "Face", emoji: "🧖", sort_order: 20 },
  { id: "beard", label_es: "Barba", label_en: "Beard", emoji: "🧔", sort_order: 30 },
  { id: "fragrance", label_es: "Perfumería", label_en: "Fragrance", emoji: "🌸", sort_order: 40 },
  { id: "enhancement", label_es: "Enhancement", label_en: "Enhancement", emoji: "✨", sort_order: 50 },
  { id: "hair_color", label_es: "Tinte", label_en: "Hair Color", emoji: "🎨", sort_order: 60 },
  { id: "styling", label_es: "Styling", label_en: "Styling", emoji: "💈", sort_order: 70 },
  { id: "aftercare", label_es: "Aftercare", label_en: "Aftercare", emoji: "🧴", sort_order: 80 },
  { id: "other", label_es: "Otros", label_en: "Other", emoji: "📦", sort_order: 90 },
];

const BY_ID = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

export function categoryLabel(id: string | null | undefined, lang: "es" | "en" = "es"): string {
  if (!id) return lang === "en" ? "Other" : "Otros";
  const c = BY_ID.get(id);
  if (!c) return id; // a category added straight to the database
  return lang === "en" ? c.label_en : c.label_es;
}

export function categoryEmoji(id: string | null | undefined): string {
  return BY_ID.get(id ?? "")?.emoji ?? "📦";
}

/**
 * Minutes a set of chosen products adds to an appointment.
 *
 * Kept here rather than inline so the booking wizard, the slot generator and
 * the barber's panel can't drift apart on what a booking actually lasts.
 */
export function extraMinutesFor(
  products: { id: string; extra_minutes?: number | null }[],
  chosenIds: Iterable<string>
): number {
  const chosen = new Set(chosenIds);
  return products
    .filter((p) => chosen.has(p.id))
    .reduce((sum, p) => sum + (p.extra_minutes ?? 0), 0);
}
