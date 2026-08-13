"use server";

import { createClient } from "@/lib/supabase/server";
import { sendAll, emailConfigured } from "@/lib/email/send";
import { resolveBarberInbox } from "@/lib/email/recipients";
import { calendarInvite } from "@/lib/email/invite";
import {
  clientBookingConfirmed,
  barberNewBooking,
  bookingCancelled,
  bookingRescheduled,
  type AppointmentEmailData,
} from "@/lib/email/templates";

/**
 * The emails that go out around a booking the client made.
 *
 * Deliberately fire-and-forget from the caller's point of view. A booking is
 * real the moment its row is committed; nothing here is allowed to fail it.
 */

/** Pulls the full picture of one appointment for an email. */
async function loadAppointment(appointmentId: string): Promise<
  | {
      data: AppointmentEmailData;
      clientEmail: string | null;
      previousStartsAt?: string;
    }
  | null
> {
  const supabase = await createClient();

  const [{ data: apt }, { data: business }, { data: barber }, { data: products }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, price, notes, guest_name, clients(full_name, email), services(name, duration_minutes)"
        )
        .eq("id", appointmentId)
        .maybeSingle(),
      supabase
        .from("business_settings")
        .select("name, address, phone")
        .eq("id", 1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("appointment_products")
        .select("quantity, products(name)")
        .eq("appointment_id", appointmentId),
    ]);

  if (!apt) return null;

  const client = apt.clients as unknown as { full_name: string; email: string | null } | null;
  const service = apt.services as unknown as {
    name: string;
    duration_minutes: number;
  } | null;

  const address = business?.address ?? null;

  return {
    clientEmail: client?.email ?? null,
    data: {
      clientName: client?.full_name ?? "Cliente",
      serviceName: service?.name ?? "Servicio",
      startsAt: apt.starts_at,
      endsAt: apt.ends_at,
      durationMinutes: service?.duration_minutes ?? 30,
      price: Number(apt.price),
      confirmationCode: apt.id.replace(/-/g, "").slice(0, 6).toUpperCase(),
      barberName: barber?.full_name ?? "Amado",
      shopName: business?.name ?? "Amado Blends",
      shopAddress: address,
      shopPhone: business?.phone ?? null,
      // Letting the phone's maps app resolve the address avoids storing a
      // link that goes stale when the shop moves
      mapsUrl: address
        ? `https://maps.google.com/?q=${encodeURIComponent(
            `${business?.name ?? "Amado Blends"} ${address}`
          )}`
        : null,
      guestName: apt.guest_name,
      notes: apt.notes,
      products: (products ?? []).map((p) => ({
        quantity: p.quantity,
        name: (p.products as unknown as { name: string } | null)?.name ?? "",
      })),
    },
  };
}

/*
 * The barber's bell is filled by a database trigger on `appointments`
 * (migration 26), not from here.
 *
 * Doing it in application code failed silently for two reasons at once: the
 * notifications table is admin-only under RLS, so a client's session could
 * never insert into it, and the columns being written didn't exist. A trigger
 * runs as the table owner and fires for every path — client booking, panel
 * booking, or a hand-written SQL insert — so it can't be bypassed or
 * forgotten.
 */

export async function notifyBookingCreated(appointmentId: string): Promise<void> {
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  if (!emailConfigured()) return;

  const barberTo = await resolveBarberInbox(await createClient());
  const mails = [];

  // The .ics is what puts the appointment on their calendar, not just in
  // their inbox — see lib/email/ics.ts
  const invite = calendarInvite(appointmentId, data, {
    method: "REQUEST",
    sequence: 0,
    attendeeEmail: clientEmail,
  });

  if (clientEmail) {
    const m = clientBookingConfirmed(data);
    mails.push({
      to: clientEmail,
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: [invite],
    });
  }
  if (barberTo) {
    const m = barberNewBooking(data);
    mails.push({
      to: barberTo,
      subject: m.subject,
      html: m.html,
      text: m.text,
      // Replying to the notice reaches the client directly
      replyTo: clientEmail ?? undefined,
      attachments: [invite],
    });
  }

  await sendAll(mails);
}

export async function notifyBookingCancelled(appointmentId: string): Promise<void> {
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  if (!emailConfigured()) return;

  const barberTo = await resolveBarberInbox(await createClient());
  const mails = [];

  // CANCEL with a high sequence removes it from the calendar for good
  const invite = calendarInvite(appointmentId, data, {
    method: "CANCEL",
    sequence: 99,
    attendeeEmail: clientEmail,
  });

  if (clientEmail) {
    const m = bookingCancelled(data, { forBarber: false });
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text, attachments: [invite] });
  }
  if (barberTo) {
    const m = bookingCancelled(data, { forBarber: true });
    mails.push({ to: barberTo, subject: m.subject, html: m.html, text: m.text, attachments: [invite] });
  }

  await sendAll(mails);
}

export async function notifyBookingRescheduled(
  appointmentId: string,
  previousStartsAt: string
): Promise<void> {
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  if (!emailConfigured()) return;

  const barberTo = await resolveBarberInbox(await createClient());
  const mails = [];

  // A REQUEST with the same UID and a higher sequence moves the existing
  // entry rather than adding a second one
  const invite = calendarInvite(appointmentId, data, {
    method: "REQUEST",
    sequence: 1,
    attendeeEmail: clientEmail,
  });

  if (clientEmail) {
    const m = bookingRescheduled(data, { startsAt: previousStartsAt }, { forBarber: false });
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text, attachments: [invite] });
  }
  if (barberTo) {
    const m = bookingRescheduled(data, { startsAt: previousStartsAt }, { forBarber: true });
    mails.push({ to: barberTo, subject: m.subject, html: m.html, text: m.text, attachments: [invite] });
  }

  await sendAll(mails);
}
