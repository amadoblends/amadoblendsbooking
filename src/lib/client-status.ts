/**
 * The five things a client account can be, and what each one means.
 *
 * They were previously conflated, which made them impossible to act on: a
 * client who hadn't visited in a while looked the same as one who had been
 * shown the door. They behave differently, so they're distinct:
 *
 *   active      — a normal client
 *   inactive    — hasn't been in for a while; *derived*, never stored
 *   deactivated — the account was closed administratively; history is kept
 *   blocked     — can't book; history and money are kept, profile stays
 *   deleted     — genuinely removed
 *
 * `inactive` is deliberately not part of the stored status. It's a function of
 * the last visit's date, so a stored copy would rot the moment time passed.
 */

/** What the database actually stores. */
export type StoredClientStatus = "active" | "deactivated" | "blocked" | "deleted";

/** What the panel shows, including the one that's worked out on the fly. */
export type ClientStatus = StoredClientStatus | "inactive";

/** No visit in this long and an active client reads as inactive. */
export const INACTIVE_AFTER_DAYS = 90;

export interface StatusMeta {
  label: string;
  /** One line on what it means, for the barber. */
  hint: string;
  /** Tailwind classes for the badge. */
  className: string;
  /** Whether this client can take an online booking. */
  canBook: boolean;
}

export const STATUS_META: Record<ClientStatus, StatusMeta> = {
  active: {
    label: "Activo",
    hint: "Puede reservar con normalidad.",
    className: "bg-success-light text-success",
    canBook: true,
  },
  inactive: {
    label: "Inactivo",
    hint: `Sin visitas en más de ${INACTIVE_AFTER_DAYS} días. Puede reservar.`,
    className: "bg-warning-light text-warning",
    canBook: true,
  },
  deactivated: {
    label: "Desactivado",
    hint: "Cuenta dada de baja. Se conserva todo su historial.",
    className: "bg-border text-muted",
    canBook: false,
  },
  blocked: {
    label: "Bloqueado",
    hint: "No puede reservar. Su historial se conserva.",
    className: "bg-danger-light text-danger",
    canBook: false,
  },
  deleted: {
    label: "Eliminado",
    hint: "Cuenta eliminada.",
    className: "bg-border text-muted",
    canBook: false,
  },
};

/** Private to the barber. The client is never told which of these applies. */
export const BLOCK_REASONS = [
  { value: "no_shows", label: "No se presenta", hint: "Faltas repetidas" },
  { value: "payment", label: "Problemas de pago", hint: "Cobros pendientes" },
  { value: "behavior", label: "Comportamiento", hint: "Conducta inapropiada" },
  { value: "other", label: "Otro", hint: "Escribe el motivo" },
] as const;

export type BlockReason = (typeof BLOCK_REASONS)[number]["value"];

export function blockReasonLabel(value: string | null | undefined): string {
  return BLOCK_REASONS.find((r) => r.value === value)?.label ?? "Otro";
}

/**
 * What to show for this client.
 *
 * A stored status other than active always wins: someone blocked is blocked
 * whether or not they've been in recently. Only an active client can read as
 * inactive, and only because of when they last came.
 */
export function effectiveStatus(
  stored: StoredClientStatus | null | undefined,
  lastVisit: string | null,
  now = Date.now()
): ClientStatus {
  const status = stored ?? "active";
  if (status !== "active") return status;

  if (!lastVisit) return "active";
  const days = (now - Date.parse(lastVisit)) / 86_400_000;
  return days > INACTIVE_AFTER_DAYS ? "inactive" : "active";
}

/** Whether this client may take an online booking. */
export function canBook(stored: StoredClientStatus | null | undefined): boolean {
  return (stored ?? "active") === "active";
}

/**
 * What a blocked client is told.
 *
 * Neutral on purpose: the reason is the barber's note to themselves, and
 * repeating it back would turn a business decision into an argument.
 */
export const BLOCKED_MESSAGE_ES =
  "Las reservas en línea no están disponibles para esta cuenta. Comunícate con el negocio para ayudarte.";

export const BLOCKED_MESSAGE_EN =
  "Online booking is currently unavailable for this account. Please contact the business for assistance.";
