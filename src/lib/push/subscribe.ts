"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Registering this device to receive push notifications.
 *
 * Two things about iOS worth knowing, because they explain most "it doesn't
 * work" reports:
 *
 *   - Safari only allows push from a PWA added to the Home Screen. In a
 *     normal browser tab the API is absent, and no amount of asking helps.
 *   - Permission must be requested from a user gesture. Asking on page load
 *     is silently denied.
 *
 * Both are reported plainly rather than swallowed.
 */

export type PushStatus =
  | "unsupported"
  | "needs-install"
  | "denied"
  | "granted"
  | "unsubscribed";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iOS gates push behind installing the PWA. */
export function needsHomeScreenInstall(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIOS) return false;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function currentStatus(): PushStatus {
  if (!pushSupported()) return needsHomeScreenInstall() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted";
  return "unsubscribed";
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToB64(key: ArrayBuffer | null): string {
  if (!key) return "";
  const bytes = new Uint8Array(key);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Asks for permission and stores the subscription.
 *
 * Must be called from a click or tap — browsers reject a permission prompt
 * that isn't tied to a gesture.
 */
export async function enablePush(opts: {
  clientId?: string | null;
  isAdmin?: boolean;
}): Promise<{ ok: boolean; status: PushStatus; error?: string }> {
  if (!pushSupported()) {
    const status = currentStatus();
    return {
      ok: false,
      status,
      error:
        status === "needs-install"
          ? "En iPhone hay que añadir la app a la pantalla de inicio para recibir notificaciones."
          : "Este navegador no admite notificaciones push.",
    };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapid) return { ok: false, status: "unsupported", error: "Falta la llave VAPID pública." };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      status: permission === "denied" ? "denied" : "unsubscribed",
      error:
        permission === "denied"
          ? "Bloqueaste las notificaciones. Actívalas en los ajustes del navegador."
          : "No se concedió el permiso.",
    };
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // Reuse an existing subscription; re-subscribing would orphan the old one
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      }));

    const json = sub.toJSON();
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, status: "unsubscribed", error: "No autenticado." };

    // Endpoint is unique, so re-enabling on the same device updates in place
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        client_id: opts.clientId ?? null,
        is_admin: opts.isAdmin ?? false,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? keyToB64(sub.getKey("p256dh")),
        auth: json.keys?.auth ?? keyToB64(sub.getKey("auth")),
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" }
    );

    if (error) return { ok: false, status: "granted", error: error.message };
    return { ok: true, status: "granted" };
  } catch (err) {
    return {
      ok: false,
      status: "unsubscribed",
      error: err instanceof Error ? err.message : "No se pudo suscribir.",
    };
  }
}

/** Stops push on this device and forgets the subscription. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;

    const supabase = createClient();
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // Already gone is the outcome we wanted anyway
  }
}
