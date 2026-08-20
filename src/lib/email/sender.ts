/**
 * Who the shop's email comes from.
 *
 * ── Why amadoblends@gmail.com can't be the From address ──────────────────
 * A transactional provider signs mail with DKIM for a domain it has verified
 * you control. Nobody can verify control of a gmail.com mailbox — Google owns
 * that domain — so a `From: …@gmail.com` sent through Resend arrives
 * unaligned with SPF and DKIM. Gmail, Outlook and Yahoo treat that as
 * spoofing: it lands in spam at best, and is rejected outright at worst. It
 * would also train recipients' filters against the address the shop actually
 * uses.
 *
 * So the identity is split, which is the standard arrangement:
 *
 *   From:     "Amado Blends" <citas@amadoblends.com>   ← verified, signed
 *   Reply-To: amadoblends@gmail.com                    ← where answers go
 *
 * The client sees "Amado Blends" as the sender, and hitting Reply reaches the
 * real inbox. Nothing is lost by not forging the From.
 */

/** The name a client sees in their inbox. */
export const BRAND_NAME = process.env.EMAIL_BRAND_NAME?.trim() || "Amado Blends";

/**
 * The verified sending address.
 *
 * Set EMAIL_FROM to a mailbox on a domain verified in Resend. Until a domain
 * is verified, Resend's own `onboarding@resend.dev` works for testing and is
 * used here so nothing silently stops sending during setup.
 */
const RAW_FROM = process.env.EMAIL_FROM?.trim() || "";

/** Where replies land. The shop's real inbox. */
export const REPLY_TO = process.env.EMAIL_REPLY_TO?.trim() || "amadoblends@gmail.com";

/** True when the address would be rejected as a forgery. */
export function isFreeMailboxDomain(address: string): boolean {
  const domain = address.split("@")[1]?.toLowerCase() ?? "";
  return ["gmail.com", "googlemail.com", "hotmail.com", "outlook.com", "yahoo.com"].includes(
    domain
  );
}

/**
 * The From header, with the brand name attached.
 *
 * If EMAIL_FROM is a free mailbox, the address is *not* used: sending as it
 * would fail authentication and damage the shop's deliverability. The mail
 * goes out from the provider's test sender instead, still branded, and the
 * misconfiguration is reported rather than hidden.
 */
export function fromHeader(): { from: string; warning: string | null } {
  if (!RAW_FROM) {
    return {
      from: `${BRAND_NAME} <onboarding@resend.dev>`,
      warning:
        "EMAIL_FROM no está configurado. Los correos salen desde el remitente de prueba de Resend.",
    };
  }

  if (isFreeMailboxDomain(RAW_FROM)) {
    return {
      from: `${BRAND_NAME} <onboarding@resend.dev>`,
      warning:
        `No se puede enviar como ${RAW_FROM}: ningún proveedor puede firmar correo de gmail.com ` +
        `y los correos acabarían en spam. Verifica un dominio propio en Resend y pon ahí ` +
        `EMAIL_FROM; ${REPLY_TO} sigue siendo la dirección de respuesta.`,
    };
  }

  // Already carries a display name — respect it
  if (RAW_FROM.includes("<")) return { from: RAW_FROM, warning: null };

  return { from: `${BRAND_NAME} <${RAW_FROM}>`, warning: null };
}
