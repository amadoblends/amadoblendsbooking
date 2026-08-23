/**
 * The accent palettes, so one can be chosen by looking rather than arguing.
 *
 * ── Why this is a real feature and not a hack ────────────────────────────
 * Every tintable surface reads from three CSS variables. Swapping the accent
 * is therefore a change to three values, not a search through components —
 * which is the whole reason to keep the accent out of components in the
 * first place.
 *
 * It deliberately moves the button, the active tab, the small icons and the
 * highlights, and NOT page backgrounds. The reference this is drawn from is
 * mostly paper and photography with one coloured control; flooding the app
 * with the accent is what makes an interface look branded instead of
 * designed.
 */

export interface Accent {
  id: string;
  label: string;
  /** The accent itself: buttons, active tabs, links. */
  brand: string;
  /** Pressed and hover states. */
  dark: string;
  /** The barely-there tint behind selected chips and badges. */
  light: string;
  /** Text on top of a `brand` fill. */
  on: string;
  /** Same three, for dark mode, where a light tint has to be a dark one. */
  darkModeLight: string;
}

export const ACCENTS: Accent[] = [
  {
    id: "orange",
    label: "Naranja",
    brand: "#ff6a3d",
    dark: "#e0521f",
    light: "#fff1ea",
    on: "#ffffff",
    darkModeLight: "#2a170e",
  },
  {
    id: "burnt",
    label: "Naranja quemado",
    brand: "#b8542a",
    dark: "#96421f",
    light: "#f8ede7",
    on: "#ffffff",
    darkModeLight: "#25150d",
  },
  {
    id: "champagne",
    label: "Champán",
    brand: "#b08d57",
    dark: "#8f7043",
    light: "#f7f1e6",
    on: "#ffffff",
    darkModeLight: "#241d12",
  },
  {
    id: "beige",
    label: "Beige",
    brand: "#a1907c",
    dark: "#847462",
    light: "#f5f2ed",
    on: "#ffffff",
    darkModeLight: "#211e1a",
  },
  {
    id: "silver",
    label: "Plata",
    // Mid-grey rather than literal silver: a light metallic can't carry
    // white text, and an accent that can't hold a button isn't an accent
    brand: "#71717a",
    dark: "#52525b",
    light: "#f2f2f3",
    on: "#ffffff",
    darkModeLight: "#1e1e21",
  },
  {
    id: "black",
    label: "Negro",
    brand: "#1c1c1e",
    dark: "#000000",
    light: "#f1f1f2",
    on: "#ffffff",
    darkModeLight: "#232326",
  },
  {
    id: "blue",
    label: "Azul eléctrico",
    brand: "#2563eb",
    dark: "#1d4ed8",
    light: "#eaf0fe",
    on: "#ffffff",
    darkModeLight: "#0f1a33",
  },
  {
    id: "red",
    label: "Rojo profundo",
    brand: "#a4243b",
    dark: "#851c2f",
    light: "#faebee",
    on: "#ffffff",
    darkModeLight: "#2a0f16",
  },
];

export const DEFAULT_ACCENT = ACCENTS[0];

export function accentById(id: string | null | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? DEFAULT_ACCENT;
}

/** Where the choice is remembered while it's still being decided. */
export const ACCENT_KEY = "accentPreview.v1";

/**
 * Writes an accent onto the document.
 *
 * Sets the variables the whole app already reads, so the change lands
 * everywhere at once with no re-render — the button, the active tab and the
 * chips update in the same frame the choice is made.
 */
export function applyAccent(accent: Accent, isDark: boolean): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--color-brand", accent.brand);
  root.setProperty("--color-brand-dark", accent.dark);
  root.setProperty("--color-brand-light", isDark ? accent.darkModeLight : accent.light);
  root.setProperty("--color-brand-on", accent.on);
}
