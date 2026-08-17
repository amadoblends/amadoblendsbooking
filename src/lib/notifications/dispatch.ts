import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush, pushConfigured } from "@/lib/push/web-push";

/**
 * One event in, every enabled channel out.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The bell, the emails and the push notifications used to be three separate
 * code paths. Three paths means three chances to disagree about what
 * happened, to fire twice, or to silently skip one with no record.
 *
 * Now there is a single `notification_events` row per thing that happened.
 * Every channel is a consequence of it, and the outcome of each is written
 * back onto the same row — so the history says not just what happened but
 * where it was delivered and where it failed.
 */

export type EventKind =
  | "booking_created"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_updated"
  | "reminder";

export type Channel = "in_app" | "push" | "email" | "sms";

export interface NotificationEvent {
  kind: EventKind;
  appointmentId?: string | null;
  clientId?: string | null;
  actor: "client" | "barber" | "system";
  title: string;
  body: string;
  /** Where tapping the notification should land. */
  href?: string | null;
  payload?: Record<string, unknown>;
}

export interface DispatchOptions {
  /** Also notify the barber's own devices. */
  toBarber?: boolean;
  /** Skip channels the caller handles itself, e.g. email sent elsewhere. */
  skip?: Channel[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

/**
 * Records the event, then delivers it. Returns the event id so a caller that
 * sends its own email can write that result back.
 *
 * Never throws — a notification failing must not fail the booking it
 * describes.
 */
export async function dispatch(
  supabase: Db,
  event: NotificationEvent,
  options: DispatchOptions = {}
): Promise<{ eventId: string | null; channels: Record<string, string> }> {
  const channels: Record<string, string> = {};
  const skip = new Set(options.skip ?? []);

  // 1. The event itself, written first so every channel can reference it
  const { data: row } = await supabase
    .from("notification_events")
    .insert({
      kind: event.kind,
      appointment_id: event.appointmentId ?? null,
      client_id: event.clientId ?? null,
      actor: event.actor,
      title: event.title,
      body: event.body,
      href: event.href ?? null,
      payload: event.payload ?? {},
    })
    .select("id")
    .single();

  const eventId = row?.id ?? null;

  // 2. In-app, for the client's own bell
  if (!skip.has("in_app") && event.clientId) {
    const { error } = await supabase.from("client_notifications").insert({
      client_id: event.clientId,
      title: event.title,
      body: event.body,
      type: "cita",
    });
    channels.in_app = error ? `failed: ${error.message}` : "sent";
  } else if (!event.clientId) {
    channels.in_app = "skipped: no client";
  }

  // 3. Push, to every device that opted in
  if (!skip.has("push")) {
    channels.push = await deliverPush(supabase, event, options.toBarber ?? false);
  }

  // 4. SMS isn't wired to a provider yet; recorded so the gap is visible
  if (!skip.has("sms")) channels.sms = "skipped: no provider";

  if (eventId) {
    await supabase.from("notification_events").update({ channels }).eq("id", eventId);
  }

  return { eventId, channels };
}

/** Adds the outcome of a channel the caller handled itself. */
export async function recordChannel(
  supabase: Db,
  eventId: string | null,
  channel: Channel,
  outcome: string
): Promise<void> {
  if (!eventId) return;
  const { data } = await supabase
    .from("notification_events")
    .select("channels")
    .eq("id", eventId)
    .maybeSingle();

  const channels = { ...(data?.channels ?? {}), [channel]: outcome };
  await supabase.from("notification_events").update({ channels }).eq("id", eventId);
}

async function deliverPush(
  supabase: Db,
  event: NotificationEvent,
  toBarber: boolean
): Promise<string> {
  if (!pushConfigured()) return "skipped: not configured";

  // The client's devices, and optionally the barber's
  const filters: string[] = [];
  if (event.clientId) filters.push(`client_id.eq.${event.clientId}`);
  if (toBarber) filters.push("is_admin.eq.true");
  if (filters.length === 0) return "skipped: no target";

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, client_id")
    .or(filters.join(","));

  if (!subs || subs.length === 0) return "skipped: no subscriptions";

  // Respect the client's own preference, once, rather than per device
  if (event.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("notify_push")
      .eq("id", event.clientId)
      .maybeSingle();
    if (client && client.notify_push === false) return "skipped: client opted out";
  }

  const message = {
    title: event.title,
    body: event.body,
    url: event.href ?? "/citas",
    // Same tag replaces an older notice about the same appointment instead
    // of stacking a second one
    tag: event.appointmentId ? `apt-${event.appointmentId}` : event.kind,
  };

  const results = await Promise.all(
    subs.map(async (s) => {
      const r = await sendPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        message
      );
      // A browser that dropped the subscription will never accept another;
      // deleting keeps the table from filling with dead rows.
      if (r.gone) await supabase.from("push_subscriptions").delete().eq("id", s.id);
      else if (r.ok) {
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
      }
      return r;
    })
  );

  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  if (sent === 0) return `failed: 0/${results.length} (${results[0]?.error ?? "unknown"})`;
  return failed === 0 ? `sent: ${sent}` : `sent: ${sent}, failed: ${failed}`;
}
