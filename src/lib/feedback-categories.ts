/**
 * What a piece of feedback is about, within its area.
 *
 * The area already separates the app from the service. The category says what
 * kind of thing it is inside that area, which is what decides whether it gets
 * fixed today or goes on a list — a crash and a wish for a new feature are
 * both "app feedback" and need completely different handling.
 */

export type FeedbackArea = "app" | "service";

export interface CategoryMeta {
  value: string;
  es: string;
  en: string;
  emoji: string;
}

export const APP_CATEGORIES: CategoryMeta[] = [
  { value: "bug", es: "Algo falla", en: "Bug", emoji: "🐞" },
  { value: "improvement", es: "Mejora", en: "Improvement", emoji: "✨" },
  { value: "suggestion", es: "Sugerencia", en: "Suggestion", emoji: "💡" },
  { value: "other", es: "Otro", en: "Other", emoji: "💬" },
];

export const SERVICE_CATEGORIES: CategoryMeta[] = [
  { value: "service", es: "El servicio", en: "Service", emoji: "✂️" },
  { value: "experience", es: "La experiencia", en: "Experience", emoji: "🪑" },
  { value: "suggestion", es: "Sugerencia", en: "Suggestion", emoji: "💡" },
  { value: "other", es: "Otro", en: "Other", emoji: "💬" },
];

export function categoriesFor(area: FeedbackArea): CategoryMeta[] {
  return area === "app" ? APP_CATEGORIES : SERVICE_CATEGORIES;
}

/** The label for one category, falling back rather than showing a raw value. */
export function feedbackCategoryLabel(
  area: FeedbackArea,
  value: string | null | undefined,
  lang: "es" | "en" = "es"
): string {
  const found = categoriesFor(area).find((c) => c.value === value);
  const fallback = categoriesFor(area)[categoriesFor(area).length - 1];
  return (found ?? fallback)[lang];
}

export function feedbackCategoryEmoji(
  area: FeedbackArea,
  value: string | null | undefined
): string {
  return categoriesFor(area).find((c) => c.value === value)?.emoji ?? "💬";
}

/** A category only makes sense inside its own area. */
export function isValidCategory(area: FeedbackArea, value: string): boolean {
  return categoriesFor(area).some((c) => c.value === value);
}
