import { buildIcs, icsBase64, type IcsMethod } from "@/lib/email/ics";
import type { Attachment } from "@/lib/email/send";
import type { AppointmentEmailData } from "@/lib/email/templates";

/**
 * Turns an appointment into the `invite.ics` attachment that puts it on the
 * recipient's calendar.
 *
 * `sequence` matters: a calendar ignores an update whose sequence isn't higher
 * than the copy it already holds. Booking sends 0, each reschedule sends more,
 * and a cancellation sends the highest of all so it always wins.
 */
export function calendarInvite(
  appointmentId: string,
  d: AppointmentEmailData,
  opts: { method: IcsMethod; sequence?: number; attendeeEmail?: string | null }
): Attachment {
  const shopName = d.shopName ?? "Amado Blends";
  const who = d.guestName ?? d.clientName;

  const descriptionParts = [
    `${d.serviceName} · ${d.durationMinutes} min`,
    d.barberName ? `Con ${d.barberName}` : null,
    d.products?.length
      ? `Productos: ${d.products.map((p) => `${p.quantity}x ${p.name}`).join(", ")}`
      : null,
    d.notes ? `Notas: ${d.notes}` : null,
    d.confirmationCode ? `Código: ${d.confirmationCode}` : null,
  ].filter(Boolean) as string[];

  const ics = buildIcs({
    uid: `${appointmentId}@amadoblends`,
    method: opts.method,
    sequence: opts.sequence ?? 0,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    title: `${d.serviceName} — ${who} · ${shopName}`,
    description: descriptionParts.join("\n"),
    location: d.shopAddress ? `${shopName}, ${d.shopAddress}` : shopName,
    organizerName: shopName,
    // Falls back to a no-reply so the file is still valid without a domain
    organizerEmail: fromAddress(),
    attendeeEmail: opts.attendeeEmail ?? null,
    attendeeName: who,
    reminderMinutes: 60,
  });

  return {
    filename: "invite.ics",
    content: icsBase64(ics),
    // The method in the content type is what makes Gmail offer the RSVP row
    contentType: `text/calendar; charset=utf-8; method=${opts.method}`,
  };
}

/** The bare address out of `EMAIL_FROM`, which may be "Name <a@b.com>". */
function fromAddress(): string {
  const raw = process.env.EMAIL_FROM ?? "citas@amadoblends.com";
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}
