/**
 * Which app an account belongs to.
 *
 * ── Why this is not a frontend check ─────────────────────────────────────
 * The role is decided by `user_roles` in the database, granted only by the
 * trigger on sign-up and gated by an allowlist. Both apps ask the same
 * question through the same RPC, and RLS enforces the same answer on every
 * row underneath — so hiding a screen is the last line here, not the only
 * one.
 */

export interface AccountRoles {
  isBarber: boolean;
  isClient: boolean;
}

export const NO_ROLES: AccountRoles = { isBarber: false, isClient: false };

/** Which app a set of roles is allowed into. */
export type AppKind = "barber" | "client";

export function allowedIn(roles: AccountRoles, app: AppKind): boolean {
  return app === "barber" ? roles.isBarber : roles.isClient;
}

/**
 * What to tell someone who signed in to the wrong app.
 *
 * Says where to go rather than just refusing — the account is real and the
 * password was right, so "denied" alone would read as a fault.
 */
export function wrongAppMessage(roles: AccountRoles, app: AppKind, lang: "es" | "en" = "es") {
  if (app === "client" && roles.isBarber) {
    return lang === "en"
      ? "This account belongs to a barber. Please sign in through the Barber App."
      : "Esta cuenta es de un barbero. Inicia sesión desde la app del barbero.";
  }
  if (app === "barber" && roles.isClient) {
    return lang === "en"
      ? "This account belongs to a client. Please sign in through the Client App."
      : "Esta cuenta es de un cliente. Inicia sesión desde la app de clientes.";
  }
  // Signed in, but holding neither role — nothing to offer but a way out
  return lang === "en"
    ? "This account isn't set up for this app."
    : "Esta cuenta no tiene acceso a esta aplicación.";
}
