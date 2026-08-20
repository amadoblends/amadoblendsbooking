import { createServiceClient } from "@/lib/supabase/service";
import { dispatch, type Channel } from "@/lib/notifications/dispatch";
import { shopTime, shopLongDate } from "@/lib/timezone";

/**
 * Sending the reminders that have come due.
 *
 * ── Where this sits ──────────────────────────────────────────────────────
 *   appointment → reminder_rules → scheduled_reminders (a time, per rule)
 *               → this worker    → notification_events → email / sms / push
 *               → the result written back on both rows
 *
 * Nothing here decides *when*: the times come from the rules the barber set,
 * and the queue is maintained by database triggers, so rescheduling an
 * appointment recalculates its reminders and cancelling one drops them —
 * whether the change came from the panel, the client's app or SQL.
 *
 * What this decides is only whether a channel can actually be used: a rule
 * asking for email is not enough if the client turned email off or never gave
 * an address.
 */

/** Human phrasing for how far ahead a reminder is. */
export function describeLeadTime(minutes: number, lang: "es" | "en" = "es"): string {
  if (minutes % 1440 === 0) {
    const d = minutes / 1440;
    if (lang === "en") return d === 1 ? "1 day" : `${d} days`;
    return d === 1 ? "1 día" : `${d} días`;
  }
  if (minutes % 60 === 0) {
    const h = minutes / 60;
    if (lang === "en") return h === 1 ? "1 hour" : `${h} hours`;
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  return lang === "en" ? `${minutes} minutes` : `${minutes} minutos`;
}

interface DueReminder {
  id: string;
  appointment_id: string;
  minutes_before: number;
  channels: { email?: boolean; sms?: boolean; push?: boolean };
  starts_at: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  service_name: string | null;
}

export interface RunResult {
  claimed: number;
  sent: number;
  failed: number;
  /** Why nothing ran, when that's the answer. */
  note?: string;
}

/**
 * Which channels a reminder may actually use.
 *
 * Three things have to agree: the rule asks for it, the client accepts it,
 * and the address or device to reach them on exists. A rule wanting SMS for
 * someone with no phone isn't a failure — it's a channel that was never
 * available, and it's recorded as skipped so the log stays honest.
 */
export function usableChannels(
  rule: { email?: boolean; sms?: boolean; push?: boolean },
  client: {
    notify_email?: boolean | null;
    notify_sms?: boolean | null;
    notify_push?: boolean | null;
    email?: string | null;
    phone?: string | null;
    hasPushDevice?: boolean;
  }
): { use: Channel[]; skipped: Record<string, string> } {
  const use: Channel[] = [];
  const skipped: Record<string, string> = {};

  if (rule.email) {
    if (client.notify_email === false) skipped.email = "skipped: client opted out";
    else if (!client.email) skipped.email = "skipped: no email address";
    else use.push("email");
  }

  if (rule.sms) {
    if (client.notify_sms === false) skipped.sms = "skipped: client opted out";
    else if (!client.phone) skipped.sms = "skipped: no phone number";
    else use.push("sms");
  }

  if (rule.push) {
    if (client.notify_push === false) skipped.push = "skipped: client opted out";
    else if (client.hasPushDevice === false) skipped.push = "skipped: no registered device";
    else use.push("push");
  }

  return { use, skipped };
}

/**
 * Claims what's due and sends it.
 *
 * The claim marks rows taken in the same statement that reads them, so two
 * overlapping cron runs can't send the same reminder twice. A failure is
 * written back as `failed` with the reason rather than left looking sent.
 */
export async function runDueReminders(limit = 50): Promise<RunResult> {
  const supabase = createServiceClient();
  if (!supabase) {
    return { claimed: 0, sent: 0, failed: 0, note: "service role key not configured" };
  }

  const { data, error } = await supabase.rpc("claim_due_reminders", { p_limit: limit });
  if (error) {
    return { claimed: 0, sent: 0, failed: 0, note: `claim failed: ${error.message}` };
  }

  const due = (data ?? []) as DueReminder[];
  if (due.length === 0) return { claimed: 0, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const r of due) {
    try {
      // The client's own preferences, which the rule can enable but not override
      const { data: client } = await supabase
        .from("clients")
        .select("notify_email, notify_sms, notify_push, email, phone, user_id, language")
        .eq("id", r.client_id ?? "")
        .maybeSingle();

      let hasPushDevice = true;
      if (client?.user_id) {
        const { count } = await supabase
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", client.user_id);
        hasPushDevice = (count ?? 0) > 0;
      }

      const { use, skipped } = usableChannels(r.channels, {
        ...client,
        email: r.client_email ?? client?.email ?? null,
        phone: r.client_phone ?? client?.phone ?? null,
        hasPushDevice,
      });

      const lang = client?.language === "en" ? "en" : "es";
      const lead = describeLeadTime(r.minutes_before, lang);
      const when = `${shopLongDate(r.starts_at)} · ${shopTime(r.starts_at)}`;

      const title =
        lang === "en" ? `Reminder: your appointment in ${lead}` : `Recordatorio: tu cita en ${lead}`;
      const body =
        lang === "en"
          ? `${r.service_name ?? "Appointment"} — ${when}`
          : `${r.service_name ?? "Cita"} — ${when}`;

      /*
       * Goes through the same dispatcher every other notification uses, so a
       * reminder is recorded, delivered and logged exactly like a booking
       * confirmation. Channels the rule or the client ruled out are skipped
       * there rather than being quietly dropped here.
       */
      const all: Channel[] = ["in_app", "email", "sms", "push"];
      const { channels } = await dispatch(
        supabase,
        {
          kind: "reminder",
          appointmentId: r.appointment_id,
          clientId: r.client_id,
          actor: "system",
          title,
          body,
          href: `/citas/${r.appointment_id}`,
          payload: { minutes_before: r.minutes_before, starts_at: r.starts_at },
        },
        { skip: all.filter((c) => c !== "in_app" && !use.includes(c)) }
      );

      const result = { ...skipped, ...channels };
      const anyFailure = Object.values(result).some((v) => String(v).startsWith("failed"));

      await supabase.rpc("record_reminder_result", {
        p_id: r.id,
        p_result: result,
        p_failed: anyFailure,
        p_error: anyFailure ? "one or more channels failed" : null,
      });

      if (anyFailure) failed++;
      else sent++;
    } catch (e) {
      failed++;
      // Left as failed with the reason rather than silently marked sent
      await supabase.rpc("record_reminder_result", {
        p_id: r.id,
        p_result: {},
        p_failed: true,
        p_error: e instanceof Error ? e.message.slice(0, 300) : "unknown error",
      });
    }
  }

  return { claimed: due.length, sent, failed };
}
