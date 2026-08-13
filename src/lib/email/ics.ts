/**
 * Calendar invitations (RFC 5545).
 *
 * Attaching one of these is what makes an email land *in* the recipient's
 * calendar instead of just sitting in their inbox: Gmail, Apple Mail and
 * Outlook all read it and offer to add, move or remove the event.
 *
 * The three pieces that make it actually work:
 *
 *   UID     — the same value for every message about one appointment, so a
 *             later update replaces the original entry rather than creating a
 *             second one. We use the appointment's own id.
 *   SEQUENCE— bumped on each change; a client ignores an update whose
 *             sequence isn't higher than what it already has.
 *   METHOD  — REQUEST to add or change, CANCEL to remove.
 */

export type IcsMethod = "REQUEST" | "CANCEL";

export interface IcsEvent {
  /** Stable per appointment — the appointment id. */
  uid: string;
  method: IcsMethod;
  /** Increment on every change to the same uid. */
  sequence?: number;
  startsAt: string;
  endsAt: string;
  title: string;
  description?: string;
  location?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail?: string | null;
  attendeeName?: string | null;
  /** Minutes before the start to alert. Omit for no alarm. */
  reminderMinutes?: number;
}

/** yyyymmddThhmmssZ — iCalendar's UTC form. */
function stamp(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escapes the characters that would otherwise end a property early.
 * Order matters: backslashes first, or we'd escape our own escapes.
 */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Lines must be at most 75 octets; longer ones continue on the next line
 * starting with a single space. Clients reject files that ignore this.
 */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    parts.push(" " + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(" " + rest);
  return parts.join("\r\n");
}

export function buildIcs(ev: IcsEvent): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Amado Blends//Citas//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${ev.method}`,
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence ?? 0}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(ev.startsAt)}`,
    `DTEND:${stamp(ev.endsAt)}`,
    `SUMMARY:${esc(ev.title)}`,
    // A cancelled event must say so, or the client keeps showing it as active
    `STATUS:${ev.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `ORGANIZER;CN=${esc(ev.organizerName)}:mailto:${ev.organizerEmail}`,
  ];

  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`);

  if (ev.attendeeEmail) {
    lines.push(
      `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE${
        ev.attendeeName ? `;CN=${esc(ev.attendeeName)}` : ""
      }:mailto:${ev.attendeeEmail}`
    );
  }

  // An alarm on a cancellation would be absurd
  if (ev.reminderMinutes && ev.method === "REQUEST") {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(ev.title)}`,
      `TRIGGER:-PT${ev.reminderMinutes}M`,
      "END:VALARM"
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // CRLF is required by the spec, not a stylistic choice
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Base64 for the mail provider's attachment field. */
export function icsBase64(ics: string): string {
  return Buffer.from(ics, "utf8").toString("base64");
}
