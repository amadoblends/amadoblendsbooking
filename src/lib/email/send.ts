/**
 * Transactional email, sent through Resend's REST API.
 *
 * No SDK on purpose — it's one POST, and skipping the dependency keeps the
 * bundle and the upgrade surface small.
 *
 * Only ever imported from "use server" modules, so RESEND_API_KEY stays on
 * the server — it is deliberately not a NEXT_PUBLIC_ variable.
 *
 * ── The rule this file exists to enforce ─────────────────────────────────
 * Sending mail must NEVER break the thing that triggered it. A booking is
 * confirmed the moment the row lands in the database; if the email fails,
 * bounces, or the API key is missing, the client still has their appointment.
 * So every function here swallows its errors and reports them in the return
 * value rather than throwing.
 */

import { fromHeader, REPLY_TO } from "./sender";

const API = "https://api.resend.com/emails";

export interface SendResult {
  ok: boolean;
  /** Why it didn't go out, for logs — never shown to a client. */
  error?: string;
  skipped?: boolean;
}

export interface Attachment {
  filename: string;
  /** Base64 payload. */
  content: string;
  /** e.g. "text/calendar; method=REQUEST" — mail clients act on this. */
  contentType?: string;
}

export interface Mail {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text fallback for clients that refuse HTML. */
  text?: string;
  replyTo?: string;
  /** Calendar invitations ride along here. */
  attachments?: Attachment[];
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;

  // Not configured yet is a normal state, not an error worth alarming about
  if (!key) {
    return { ok: false, skipped: true, error: "email not configured" };
  }

  /*
   * The shop's identity in one place — see lib/email/sender. It also refuses
   * to send *as* a gmail.com address, which no provider can sign and which
   * would land the shop's mail in spam.
   */
  const { from, warning } = fromHeader();
  if (warning) console.warn("[email]", warning);

  const recipients = (Array.isArray(mail.to) ? mail.to : [mail.to])
    .map((r) => r.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { ok: false, skipped: true, error: "no recipients" };
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        // Answers reach the shop's real inbox even though the From can't be it
        reply_to: mail.replyTo ?? REPLY_TO,
        attachments: mail.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType,
        })),
      }),
      // A slow mail provider must not hold up the response to the client
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/**
 * Fire several messages without letting one failure stop the others — a
 * bounced client address shouldn't cost the barber their copy.
 */
export async function sendAll(mails: Mail[]): Promise<SendResult[]> {
  return Promise.all(mails.map(sendMail));
}
