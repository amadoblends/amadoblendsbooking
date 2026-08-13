import { shopLongDate, shopShortDate, shopTime, shopTimeRange } from "@/lib/timezone";

/** "jue 6 ago" — short enough to survive an inbox's subject truncation. */
const shopShort = (v: string) => shopShortDate(v).replace(/\.$/, "");

/**
 * Branded HTML for the transactional emails.
 *
 * Written for mail clients, not browsers: tables for layout, inline styles
 * only, no flexbox/grid, no external CSS, no web fonts. Outlook ignores most
 * modern CSS and Gmail strips <style> blocks in some views, so anything that
 * matters is set on the element itself.
 *
 * Every message also carries a plain-text version — some clients show it, and
 * spam filters weigh its absence.
 */

const BRAND = "#f2683c";
const INK = "#14151a";
const MUTED = "#6b6b75";
const LINE = "#e7e7ea";
const PAPER = "#f5f5f6";

export interface AppointmentEmailData {
  clientName: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  price: number;
  /** What the client actually pays after any discount. */
  total?: number;
  confirmationCode?: string | null;
  barberName?: string;
  shopName?: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  mapsUrl?: string | null;
  guestName?: string | null;
  products?: { name: string; quantity: number }[];
  notes?: string | null;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One label/value line inside the details card. */
function row(label: string, value: string, opts: { strong?: boolean } = {}): string {
  return `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid ${LINE};color:${MUTED};font-size:14px;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:11px 0 11px 16px;border-bottom:1px solid ${LINE};color:${INK};font-size:14px;font-weight:${opts.strong ? 700 : 600};text-align:right;">${value}</td>
    </tr>`;
}

function button(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
      <tr><td style="border-radius:12px;background:${BRAND};">
        <a href="${esc(href)}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(label)}</a>
      </td></tr>
    </table>`;
}

/**
 * The outer shell every message shares: header band, white card, footer.
 * `accent` tints the top rule so a cancellation reads differently from a
 * confirmation at a glance.
 */
function shell(opts: {
  shopName: string;
  preheader: string;
  accent?: string;
  eyebrow: string;
  title: string;
  intro: string;
  body: string;
  footerNote?: string;
}): string {
  const accent = opts.accent ?? BRAND;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased;">
  <!-- Preview line shown in the inbox list, hidden in the message itself -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:28px 12px;">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.07);">

        <tr><td style="height:4px;background:${accent};line-height:4px;font-size:0;">&nbsp;</td></tr>

        <tr><td style="padding:28px 28px 0;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent};">${esc(opts.eyebrow)}</p>
          <h1 style="margin:8px 0 0;font-size:23px;line-height:1.25;font-weight:800;color:${INK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${esc(opts.title)}</h1>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.55;color:${MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${esc(opts.intro)}</p>
        </td></tr>

        <tr><td style="padding:20px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          ${opts.body}
        </td></tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:18px 28px;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            ${esc(opts.shopName)}${opts.footerNote ? `<br>${esc(opts.footerNote)}` : ""}
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** The shared block of appointment facts. */
function detailsCard(d: AppointmentEmailData): string {
  const shopName = d.shopName ?? "Amado Blends";
  const who = d.guestName ? `${d.guestName} (invitado de ${d.clientName})` : d.clientName;

  const productLines =
    d.products && d.products.length > 0
      ? row("Productos", d.products.map((p) => `${p.quantity}× ${esc(p.name)}`).join("<br>"))
      : "";

  const locationLine = d.shopAddress
    ? row(
        "Dónde",
        d.mapsUrl
          ? `<a href="${esc(d.mapsUrl)}" style="color:${BRAND};text-decoration:none;">${esc(shopName)}<br>${esc(d.shopAddress)}</a>`
          : `${esc(shopName)}<br>${esc(d.shopAddress)}`
      )
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:14px;padding:4px 16px;">
      ${row("Cliente", esc(who))}
      ${row("Servicio", esc(d.serviceName))}
      ${row("Fecha", esc(shopLongDate(d.startsAt)))}
      ${row("Hora", esc(shopTimeRange(d.startsAt, d.endsAt)))}
      ${row("Duración", `${d.durationMinutes} min`)}
      ${d.barberName ? row("Con", esc(d.barberName)) : ""}
      ${productLines}
      ${locationLine}
      ${d.notes ? row("Notas", esc(d.notes)) : ""}
      <tr>
        <td style="padding:13px 0;color:${MUTED};font-size:14px;">Total</td>
        <td style="padding:13px 0 13px 16px;color:${INK};font-size:17px;font-weight:800;text-align:right;">${money(d.total ?? d.price)}</td>
      </tr>
    </table>

    ${
      d.confirmationCode
        ? `<p style="margin:16px 0 0;text-align:center;font-size:13px;color:${MUTED};">
             Código de confirmación
             <br>
             <span style="display:inline-block;margin-top:6px;padding:8px 18px;border:1px solid ${LINE};border-radius:999px;font-size:16px;font-weight:800;letter-spacing:.18em;color:${INK};">${esc(d.confirmationCode)}</span>
           </p>`
        : ""
    }`;
}

/** Plain-text twin of the details card. */
function detailsText(d: AppointmentEmailData): string {
  const who = d.guestName ? `${d.guestName} (invitado de ${d.clientName})` : d.clientName;
  const lines = [
    `Cliente:  ${who}`,
    `Servicio: ${d.serviceName}`,
    `Fecha:    ${shopLongDate(d.startsAt)}`,
    `Hora:     ${shopTimeRange(d.startsAt, d.endsAt)}`,
    `Duración: ${d.durationMinutes} min`,
  ];
  if (d.barberName) lines.push(`Con:      ${d.barberName}`);
  if (d.products?.length) {
    lines.push(`Productos: ${d.products.map((p) => `${p.quantity}x ${p.name}`).join(", ")}`);
  }
  if (d.shopAddress) lines.push(`Dónde:    ${d.shopName ?? "Amado Blends"}, ${d.shopAddress}`);
  if (d.notes) lines.push(`Notas:    ${d.notes}`);
  lines.push(`Total:    ${money(d.total ?? d.price)}`);
  if (d.confirmationCode) lines.push(`Código:   ${d.confirmationCode}`);
  return lines.join("\n");
}

// ── The messages ───────────────────────────────────────────────────────────

/** To the client, the moment their booking lands. */
export function clientBookingConfirmed(d: AppointmentEmailData) {
  const shopName = d.shopName ?? "Amado Blends";
  const first = d.clientName.split(" ")[0];
  return {
    subject: `Cita confirmada · ${shopShort(d.startsAt)}, ${shopTime(d.startsAt)}`,
    html: shell({
      shopName,
      preheader: `${d.serviceName} · ${shopLongDate(d.startsAt)} a las ${shopTime(d.startsAt)}`,
      eyebrow: "Cita confirmada",
      title: `Nos vemos el ${shopLongDate(d.startsAt).replace(/^\w/, (c) => c.toLowerCase())}`,
      intro: `¡Listo, ${first}! Tu cita en ${shopName} quedó reservada. Aquí están los detalles.`,
      body:
        detailsCard(d) +
        (d.shopPhone
          ? `<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:${MUTED};text-align:center;">
               ¿Necesitas cambiarla? Escríbenos al <a href="tel:${esc(d.shopPhone)}" style="color:${BRAND};text-decoration:none;font-weight:600;">${esc(d.shopPhone)}</a> o hazlo desde la app.
             </p>`
          : ""),
      footerNote: "Recibes este correo porque reservaste una cita.",
    }),
    text: `Cita confirmada en ${shopName}\n\n${detailsText(d)}\n`,
  };
}

/** To the barber, the moment a client books. */
export function barberNewBooking(d: AppointmentEmailData) {
  const shopName = d.shopName ?? "Amado Blends";
  return {
    subject: `Nueva cita · ${d.clientName} · ${shopShort(d.startsAt)}, ${shopTime(d.startsAt)}`,
    html: shell({
      shopName,
      preheader: `${d.clientName} — ${d.serviceName} — ${shopTime(d.startsAt)}`,
      eyebrow: "Nueva cita",
      title: `${d.clientName} reservó ${d.serviceName}`,
      intro: `Entró una cita nueva para el ${shopLongDate(d.startsAt)} a las ${shopTime(d.startsAt)}.`,
      body: detailsCard(d),
      footerNote: "Notificación automática de tu panel.",
    }),
    text: `Nueva cita\n\n${detailsText(d)}\n`,
  };
}

/** To whoever didn't do the cancelling. */
export function bookingCancelled(d: AppointmentEmailData, opts: { forBarber: boolean }) {
  const shopName = d.shopName ?? "Amado Blends";
  return {
    subject: opts.forBarber
      ? `Cita cancelada · ${d.clientName} · ${shopLongDate(d.startsAt)}`
      : `Tu cita del ${shopLongDate(d.startsAt)} fue cancelada`,
    html: shell({
      shopName,
      accent: "#dc2626",
      preheader: `${d.serviceName} · ${shopLongDate(d.startsAt)}`,
      eyebrow: "Cita cancelada",
      title: opts.forBarber
        ? `${d.clientName} canceló su cita`
        : "Tu cita quedó cancelada",
      intro: opts.forBarber
        ? `Ese espacio del ${shopLongDate(d.startsAt)} vuelve a estar libre en tu calendario.`
        : `Cancelamos tu cita del ${shopLongDate(d.startsAt)}. Puedes reservar otra cuando quieras.`,
      body: detailsCard(d),
      footerNote: opts.forBarber ? "Notificación automática de tu panel." : undefined,
    }),
    text: `Cita cancelada\n\n${detailsText(d)}\n`,
  };
}

/** After a change of date or time. */
export function bookingRescheduled(
  d: AppointmentEmailData,
  previous: { startsAt: string },
  opts: { forBarber: boolean }
) {
  const shopName = d.shopName ?? "Amado Blends";
  return {
    subject: opts.forBarber
      ? `Cita movida · ${d.clientName} · ahora ${shopLongDate(d.startsAt)}`
      : `Tu cita se movió al ${shopLongDate(d.startsAt)}`,
    html: shell({
      shopName,
      accent: "#ca8a04",
      preheader: `Ahora ${shopLongDate(d.startsAt)} a las ${shopTime(d.startsAt)}`,
      eyebrow: "Cita reprogramada",
      title: `Nueva hora: ${shopTime(d.startsAt)}`,
      intro: `Antes era el ${shopLongDate(previous.startsAt)} a las ${shopTime(previous.startsAt)}.`,
      body: detailsCard(d),
      footerNote: opts.forBarber ? "Notificación automática de tu panel." : undefined,
    }),
    text: `Cita reprogramada\nAntes: ${shopLongDate(previous.startsAt)} ${shopTime(previous.startsAt)}\n\n${detailsText(d)}\n`,
  };
}

/** Day-before nudge to the client. */
export function bookingReminder(d: AppointmentEmailData) {
  const shopName = d.shopName ?? "Amado Blends";
  const first = d.clientName.split(" ")[0];
  return {
    subject: `Recordatorio · tu cita es ${shopShort(d.startsAt)}, ${shopTime(d.startsAt)}`,
    html: shell({
      shopName,
      preheader: `${d.serviceName} a las ${shopTime(d.startsAt)}`,
      eyebrow: "Recordatorio",
      title: `${first}, tu cita es pronto`,
      intro: `Te esperamos el ${shopLongDate(d.startsAt)} a las ${shopTime(d.startsAt)}.`,
      body:
        detailsCard(d) +
        (d.mapsUrl ? button(d.mapsUrl, "Cómo llegar") : ""),
      footerNote: "Recibes este correo porque tienes una cita reservada.",
    }),
    text: `Recordatorio de cita\n\n${detailsText(d)}\n`,
  };
}
