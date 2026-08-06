/**
 * Keeps an in-progress booking alive across an accidental exit.
 *
 * The draft is written to localStorage on every change and read back on the
 * next visit. Two rules keep it from becoming a nuisance:
 *
 *   - it expires after 10 minutes of absence, so an abandoned booking never
 *     resurfaces days later half-filled;
 *   - the chosen time is only a *proposal*. Nothing is held while the user is
 *     away, so the wizard re-checks the slot on resume and asks for another
 *     one if somebody else took it.
 */

const KEY = "bookingDraft.v1";
export const DRAFT_TTL_MS = 10 * 60 * 1000;

export interface BookingDraft {
  step: string;
  forGuest: boolean;
  relationship: string | null;
  guestName: string;
  serviceId: string | null;
  tab: "single" | "package";
  cart: Record<string, number>;
  chosenProducts: string[];
  date: string;
  time: string;
  maxReached: number;
  /** Epoch ms of the last change. */
  savedAt: number;
}

export function saveDraft(draft: Omit<BookingDraft, "savedAt">): void {
  try {
    // A booking that hasn't chosen a service yet isn't worth restoring
    if (!draft.serviceId) {
      clearDraft();
      return;
    }
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked — the booking simply won't survive a reload
  }
}

export function loadDraft(): BookingDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as BookingDraft;
    if (typeof draft?.savedAt !== "number") {
      clearDraft();
      return null;
    }

    // Gone too long: start clean rather than resume something stale
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearDraft();
      return null;
    }
    return draft;
  } catch {
    clearDraft();
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
