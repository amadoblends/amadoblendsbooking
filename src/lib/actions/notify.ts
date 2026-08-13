"use server";

import { createClient } from "@/lib/supabase/server";
import { sendAll, barberInbox, emailConfigured } from "@/lib/email/send";
import {
  clientBookingConfirmed,
  barberNewBooking,
  bookingCancelled,
  bookingRescheduled,
  type AppointmentEmailData,
} from "@/lib/email/templates";
import { shopLongDate, shopTime } from "@/lib/timezone";

/**
 * Everything that has to happen *around* a booking once it exists: the
 * barber's in-app notification, and the emails to both sides.
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

/** Row in the barber's notification bell. */
async function notifyBarberInApp(title: string, body: string, appointmentId: string) {
  const supabase = await createClient();
  // The table belongs to the admin panel; a missing row must not break booking
  await supabase
    .from("notifications")
    .insert({ title, body, type: "cita", read: false, appointment_id: appointmentId })
    .then(
      () => undefined,
      () => undefined
    );
}

export async function notifyBookingCreated(appointmentId: string): Promise<void> {
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  await notifyBarberInApp(
    "Nueva cita",
    `${data.clientName} · ${data.serviceName} · ${shopLongDate(data.startsAt)} ${shopTime(data.startsAt)}`,
    appointmentId
  );

  if (!emailConfigured()) return;

  const barberTo = barberInbox();
  const mails = [];

  if (clientEmail) {
    const m = clientBookingConfirmed(data);
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text });
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
    });
  }

  await sendAll(mails);
}

export async function notifyBookingCancelled(appointmentId: string): Promise<void> {
  const loaded = await loadAppointment(appointmentId);
  if (!loaded) return;
  const { data, clientEmail } = loaded;

  await notifyBarberInApp(
    "Cita cancelada",
    `${data.clientName} · ${shopLongDate(data.startsAt)} ${shopTime(data.startsAt)}`,
    appointmentId
  );

  if (!emailConfigured()) return;

  const barberTo = barberInbox();
  const mails = [];

  if (clientEmail) {
    const m = bookingCancelled(data, { forBarber: false });
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text });
  }
  if (barberTo) {
    const m = bookingCancelled(data, { forBarber: true });
    mails.push({ to: barberTo, subject: m.subject, html: m.html, text: m.text });
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

  await notifyBarberInApp(
    "Cita reprogramada",
    `${data.clientName} · ahora ${shopLongDate(data.startsAt)} ${shopTime(data.startsAt)}`,
    appointmentId
  );

  if (!emailConfigured()) return;

  const barberTo = barberInbox();
  const mails = [];

  if (clientEmail) {
    const m = bookingRescheduled(data, { startsAt: previousStartsAt }, { forBarber: false });
    mails.push({ to: clientEmail, subject: m.subject, html: m.html, text: m.text });
  }
  if (barberTo) {
    const m = bookingRescheduled(data, { startsAt: previousStartsAt }, { forBarber: true });
    mails.push({ to: barberTo, subject: m.subject, html: m.html, text: m.text });
  }

  await sendAll(mails);
}
