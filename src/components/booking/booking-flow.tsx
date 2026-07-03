"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, format,
  isSameMonth, isSameDay, isBefore, isAfter, startOfDay, addDays, addMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Check, Loader2, Scissors, Sparkles,
  CalendarDays, Timer, ShoppingBag, Minus, Plus, UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient as createBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { GuestForm } from "./guest-form";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  image_url: string | null;
  kind: "single" | "package";
  description?: string | null;
}

interface Promotion {
  id: string;
  title: string;
  discount_percent: number;
  service_id: string | null;
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
  ends_on: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

interface AvailDay {
  weekday: number;
  is_active: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_minutes: number;
}

interface BusyInterval {
  start: number; // epoch ms
  end: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const HOLD_SECONDS = 60;

function toMins(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMins(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtSlot(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return `${dh}:${String(m).padStart(2, "0")} ${p}`;
}
function slotToDate(dateStr: string, mins: number) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0);
}
function generateSlots(
  day: AvailDay,
  durMins: number,
  minNoticeMins: number,
  dateStr: string,
  busy: BusyInterval[]
): string[] {
  if (!day.is_active) return [];
  const start = toMins(day.start_time);
  const end = toMins(day.end_time);
  const step = day.slot_minutes;
  const bS = day.break_start_time ? toMins(day.break_start_time) : null;
  const bE = day.break_end_time ? toMins(day.break_end_time) : null;
  const nowPlusNotice = addMinutes(new Date(), minNoticeMins);
  const out: string[] = [];

  for (let t = start; t + durMins <= end; t += step) {
    if (bS !== null && bE !== null && t < bE && t + durMins > bS) continue;
    const slotStart = slotToDate(dateStr, t);
    if (isBefore(slotStart, nowPlusNotice)) continue;
    const sMs = slotStart.getTime();
    const eMs = sMs + durMins * 60000;
    if (busy.some((b) => sMs < b.end && eMs > b.start)) continue;
    out.push(fromMins(t));
  }
  return out;
}

type Step = "service" | "products" | "datetime" | "confirm" | "success";
type Tab = "single" | "package";

// Best applicable discount % for a service at a given date + time (0 if none)
function discountFor(
  promotions: Promotion[],
  service: Service | null,
  dateStr: string,
  time: string
): number {
  if (!service || !dateStr) return 0;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const date = new Date(y, mo - 1, d);
  const weekday = date.getDay();
  const slotMins = time ? toMins(time) : null;

  let best = 0;
  for (const p of promotions) {
    if (p.service_id && p.service_id !== service.id) continue;
    if (!p.weekdays.includes(weekday)) continue;
    if (p.ends_on && dateStr > p.ends_on) continue;
    if (p.start_time && p.end_time && slotMins !== null) {
      const s = toMins(String(p.start_time).slice(0, 5));
      const e = toMins(String(p.end_time).slice(0, 5));
      if (slotMins < s || slotMins >= e) continue;
    }
    if (p.discount_percent > best) best = p.discount_percent;
  }
  return best;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BookingFlow({
  clientId,
  services,
  products,
  availability,
  promotions = [],
  bookingWindowDays,
  minNoticeMinutes,
  preselectedServiceId,
}: {
  clientId: string;
  services: Service[];
  products: Product[];
  availability: AvailDay[];
  promotions?: Promotion[];
  bookingWindowDays: number;
  minNoticeMinutes: number;
  preselectedServiceId?: string;
}) {
  const router = useRouter();

  const initService = preselectedServiceId
    ? (services.find((s) => s.id === preselectedServiceId) ?? null)
    : null;

  const [step, setStep] = useState<Step>(initService ? "products" : "service");
  const [tab, setTab] = useState<Tab>("single");
  const [service, setService] = useState<Service | null>(initService);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dayChosen, setDayChosen] = useState(false);
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(new Date()));
  const [monthBusy, setMonthBusy] = useState<BusyInterval[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [busyVersion, setBusyVersion] = useState(0);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(HOLD_SECONDS);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  // Success step: guest flow
  const [guestPrompt, setGuestPrompt] = useState<"ask" | "form" | "done" | "skipped">("ask");

  const holdActive = holdExpiresAt !== null;

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  const singles = services.filter((s) => s.kind !== "package");
  const packages = services.filter((s) => s.kind === "package");
  const shown = tab === "single" ? singles : packages;

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartCount = cartItems.reduce((a, [, q]) => a + q, 0);
  const cartTotal = cartItems.reduce((a, [id, q]) => {
    const p = products.find((pp) => pp.id === id);
    return a + (p ? Number(p.price) * q : 0);
  }, 0);

  // Effective service price after the best applicable promotion
  const discountPct = discountFor(promotions, service, date, time);
  const basePrice = service?.price ?? 0;
  const servicePrice = Math.round(basePrice * (1 - discountPct / 100) * 100) / 100;

  const getDayAvail = useCallback(
    (dateStr: string) => {
      const wd = new Date(dateStr + "T00:00:00").getDay();
      return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
    },
    [availability]
  );

  const dayAvail = useMemo(() => getDayAvail(date), [date, getDayAvail]);

  // ── Busy times for the visible month ───────────────────────────────────────
  useEffect(() => {
    if (step !== "datetime" && step !== "confirm") return;
    let alive = true;
    setBusyLoading(true);
    const supabase = createBrowser();
    const gridStart = startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 });
    const gridEnd = addDays(endOfWeek(endOfMonth(calCursor), { weekStartsOn: 1 }), 1);
    supabase
      .rpc("get_busy_times", {
        p_start: gridStart.toISOString(),
        p_end: gridEnd.toISOString(),
      })
      .then(({ data }) => {
        if (!alive) return;
        setMonthBusy(
          (data ?? []).map((b: { starts_at: string; ends_at: string }) => ({
            start: new Date(b.starts_at).getTime(),
            end: new Date(b.ends_at).getTime(),
          }))
        );
        setBusyLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [calCursor, step, busyVersion]);

  const slots = useMemo(() => {
    if (!dayAvail || !service) return [];
    return generateSlots(dayAvail, service.duration_minutes, minNoticeMinutes, date, monthBusy);
  }, [dayAvail, service, date, minNoticeMinutes, monthBusy]);

  const dayCapacity = useCallback(
    (d: Date): number | null => {
      if (!service) return null;
      const wd = d.getDay();
      if (!activeWeekdays.has(wd)) return null;
      if (isBefore(startOfDay(d), today) || isAfter(startOfDay(d), maxDate)) return null;
      const ds = format(d, "yyyy-MM-dd");
      const avail = getDayAvail(ds);
      if (!avail) return null;
      return generateSlots(avail, service.duration_minutes, minNoticeMinutes, ds, monthBusy)
        .length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, monthBusy, minNoticeMinutes, getDayAvail]
  );

  // ── Hold management ────────────────────────────────────────────────────────

  const releaseHolds = useCallback(() => {
    setHoldExpiresAt(null);
    createBrowser().rpc("release_my_holds").then(() => {});
  }, []);

  const releaseRef = useRef(releaseHolds);
  releaseRef.current = releaseHolds;
  useEffect(() => {
    const onHide = () => releaseRef.current();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      releaseRef.current();
    };
  }, []);

  useEffect(() => {
    if (holdExpiresAt === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((holdExpiresAt - Date.now()) / 1000));
      setHoldSecondsLeft(left);
      if (left === 0) {
        setHoldExpiresAt(null);
        setTime("");
        setHoldError("Tu reserva temporal expiró. Elige una hora de nuevo.");
        setBusyVersion((v) => v + 1);
        if (step === "confirm") setStep("datetime");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt, step]);

  async function selectTime(slot: string) {
    setHoldError(null);
    setTime(slot);
    const supabase = createBrowser();
    const [h, mi] = slot.split(":").map(Number);
    const startsAt = slotToDate(date, h * 60 + mi);
    const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 30) * 60000);
    const { data: holdId } = await supabase.rpc("hold_slot", {
      p_starts: startsAt.toISOString(),
      p_ends: endsAt.toISOString(),
    });
    if (!holdId) {
      setTime("");
      setHoldError("Ese horario acaba de ocuparse. Elige otro.");
      setBusyVersion((v) => v + 1);
      return;
    }
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setHoldSecondsLeft(HOLD_SECONDS);
  }

  function resetToDatetime() {
    releaseHolds();
    setTime("");
    setStep("datetime");
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!service || !time) return;
    setLoading(true);
    setError(null);

    const supabase = createBrowser();
    const [h, mi] = time.split(":").map(Number);
    const startsAt = slotToDate(date, h * 60 + mi);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

    const { data: inserted, error: insertError } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        service_id: service.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price: servicePrice,
        status: "pendiente",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(
        insertError?.code === "23P01"
          ? "Ese horario acaba de ocuparse. Elige otro."
          : "No se pudo crear la cita. Intenta de nuevo."
      );
      setLoading(false);
      if (insertError?.code === "23P01") resetToDatetime();
      return;
    }

    // Attach requested products
    if (cartItems.length > 0) {
      await supabase.from("appointment_products").insert(
        cartItems.map(([productId, quantity]) => ({
          appointment_id: inserted.id,
          product_id: productId,
          quantity,
        }))
      );
    }

    setAppointmentId(inserted.id);
    releaseHolds();
    setGuestPrompt("ask");
    setStep("success");
    setLoading(false);
  }

  function resetAll() {
    setStep("service");
    setService(null);
    setTime("");
    setDayChosen(false);
    setAppointmentId(null);
    setCart({});
    setGuestPrompt("ask");
  }

  // ── Render: success ────────────────────────────────────────────────────────

  if (step === "success") {
    const successTotal = servicePrice + cartTotal;
    return (
      <div className="space-y-6 py-4">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center">
            <Check size={36} className="text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">¡Reserva confirmada!</h2>
        </div>

        {/* Full appointment details */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
          <SummaryRow label="Servicio" value={service?.name ?? ""} />
          <SummaryRow
            label="Fecha"
            value={format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
          />
          <SummaryRow label="Hora" value={fmtSlot(time)} />
          <SummaryRow label="Duración" value={`${service?.duration_minutes} minutos`} />
          {discountPct > 0 ? (
            <SummaryRow
              label={`Servicio (−${discountPct}% promo)`}
              value={`$${servicePrice.toFixed(2)}`}
            />
          ) : (
            <SummaryRow label="Servicio" value={`$${servicePrice.toFixed(2)}`} />
          )}
          {cartItems.map(([id, q]) => {
            const p = products.find((pp) => pp.id === id);
            if (!p) return null;
            return (
              <SummaryRow
                key={id}
                label={`${q}× ${p.name}`}
                value={`$${(Number(p.price) * q).toFixed(2)}`}
              />
            );
          })}
          <div className="flex items-center justify-between px-4 py-3 gap-3 bg-brand-light">
            <span className="text-sm font-bold text-foreground">Total (pago en el local)</span>
            <span className="text-base font-black text-brand">${successTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Guest prompt — first thing after booking */}
        {guestPrompt === "ask" && appointmentId && (
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-3 text-center">
            <div className="w-11 h-11 rounded-full bg-brand-light flex items-center justify-center mx-auto">
              <UserPlus size={20} className="text-brand" />
            </div>
            <p className="font-semibold text-sm text-foreground">
              ¿Deseas agregar un amigo o invitado a esta cita?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setGuestPrompt("skipped")}
                className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-muted"
              >
                No, gracias
              </button>
              <button
                onClick={() => setGuestPrompt("form")}
                className="flex-1 h-10 rounded-xl bg-brand text-white text-sm font-semibold"
              >
                Sí, agregar
              </button>
            </div>
          </div>
        )}

        {guestPrompt === "form" && appointmentId && (
          <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
            <p className="font-semibold text-sm text-foreground">Datos del invitado</p>
            <GuestForm
              appointmentId={appointmentId}
              services={services.map((s) => ({
                id: s.id,
                name: s.name,
                duration_minutes: s.duration_minutes,
                price: s.price,
              }))}
              onDone={() => setGuestPrompt("done")}
            />
          </div>
        )}

        {guestPrompt === "done" && (
          <div className="bg-success-light rounded-xl p-3 border border-success/20 text-center">
            <p className="text-xs text-success font-semibold">
              ✓ Invitado agregado. Te esperamos a los dos.
            </p>
          </div>
        )}

        {(guestPrompt === "done" || guestPrompt === "skipped") && (
          <div className="flex gap-3">
            <button
              onClick={resetAll}
              className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
            >
              Otra cita
            </button>
            <button
              onClick={() => router.push("/citas")}
              className="flex-1 h-11 rounded-xl bg-brand text-white text-sm font-semibold"
            >
              Mis reservas
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Render: service selection ──────────────────────────────────────────────

  if (step === "service") {
    return (
      <div className="space-y-4">
        <div className="flex rounded-xl bg-surface border border-border p-1">
          {([
            { key: "single", label: "Servicios" },
            { key: "package", label: "Paquetes" },
          ] as { key: Tab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 h-9 rounded-lg text-sm font-semibold transition-colors",
                tab === t.key ? "bg-brand text-white" : "text-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            {tab === "package" ? "Aún no hay paquetes disponibles." : "Aún no hay servicios."}
          </p>
        ) : (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {shown.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setService(s);
                  setTime("");
                  setDayChosen(false);
                  setStep("products");
                }}
                className="w-full flex items-start gap-3 bg-surface rounded-2xl border border-border p-3.5 active:bg-background text-left"
              >
                {s.image_url ? (
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                    <Image
                      src={s.image_url}
                      alt={s.name}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center"
                    style={{ background: `${s.color}26` }}
                  >
                    {s.kind === "package" ? (
                      <Sparkles size={22} style={{ color: s.color }} />
                    ) : (
                      <Scissors size={22} style={{ color: s.color }} />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-muted line-clamp-2 mt-0.5">{s.description}</p>
                  )}
                  <p className="text-xs text-muted mt-0.5">⏱ {s.duration_minutes} min</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <p className="text-base font-bold text-brand">${s.price}</p>
                  <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
                    <span className="text-white font-bold text-base leading-none">+</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: products add-on ────────────────────────────────────────────────

  if (step === "products") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setStep("service")}
          className="flex items-center gap-2 text-sm text-muted"
        >
          <ChevronLeft size={16} /> Cambiar servicio
        </button>

        <div className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-2 h-10 rounded-full shrink-0" style={{ background: service?.color }} />
          <div>
            <p className="font-semibold text-sm text-foreground">{service?.name}</p>
            <p className="text-xs text-muted">
              {service?.duration_minutes} min · ${service?.price}
            </p>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={17} className="text-brand" />
            <p className="font-semibold text-sm text-foreground">
              ¿Quieres agregar productos a tu visita?
            </p>
          </div>
          <p className="text-xs text-muted">
            Los preparamos para que los recojas y pagues en tu cita. Opcional.
          </p>

          {products.length === 0 ? (
            <p className="text-xs text-muted text-center py-3">No hay productos disponibles.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {products.map((p) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    {p.image_url ? (
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <Image
                          src={p.image_url}
                          alt={p.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                        <ShoppingBag size={15} className="text-brand/60" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted">${p.price}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() =>
                          setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] ?? 0) - 1) }))
                        }
                        disabled={qty === 0}
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center disabled:opacity-30"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-bold text-foreground w-4 text-center">
                        {qty}
                      </span>
                      <button
                        onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }))}
                        className="w-7 h-7 rounded-full bg-brand flex items-center justify-center"
                      >
                        <Plus size={13} className="text-white" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cartCount > 0 && (
            <p className="text-xs font-semibold text-brand pt-1 border-t border-border">
              {cartCount} producto{cartCount > 1 ? "s" : ""} · ${cartTotal.toFixed(2)}
            </p>
          )}
        </div>

        <button
          onClick={() => setStep("datetime")}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold"
        >
          {cartCount > 0 ? "Continuar con productos →" : "Continuar sin productos →"}
        </button>
      </div>
    );
  }

  // ── Render: date & time ────────────────────────────────────────────────────

  if (step === "datetime") {
    return (
      <div className="space-y-5">
        <button
          onClick={() => {
            releaseHolds();
            setTime("");
            setStep("products");
          }}
          className="flex items-center gap-2 text-sm text-muted"
        >
          <ChevronLeft size={16} /> Volver
        </button>

        <div className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-2 h-10 rounded-full shrink-0" style={{ background: service?.color }} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">{service?.name}</p>
            <p className="text-xs text-muted">
              {service?.duration_minutes} min · ${service?.price}
              {cartCount > 0 && ` · +${cartCount} producto${cartCount > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {dayChosen ? (
          <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <CalendarDays size={18} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground capitalize">
                {format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-xs text-muted">Ahora selecciona una hora disponible</p>
            </div>
            <button
              onClick={() => {
                setDayChosen(false);
                releaseHolds();
                setTime("");
              }}
              className="text-xs font-semibold text-brand shrink-0"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalCursor((c) => subMonths(c, 1))}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="font-semibold text-sm text-foreground capitalize">
                {format(calCursor, "MMMM yyyy", { locale: es })}
              </p>
              <button
                onClick={() => setCalCursor((c) => addMonths(c, 1))}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEK_LABELS.map((w, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted py-1">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {eachDayOfInterval({
                start: startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 }),
                end: endOfWeek(endOfMonth(calCursor), { weekStartsOn: 1 }),
              }).map((d) => {
                const wd = d.getDay();
                const inMonth = isSameMonth(d, calCursor);
                const capacity = dayCapacity(d);
                const disabled =
                  !activeWeekdays.has(wd) ||
                  isBefore(startOfDay(d), today) ||
                  isAfter(startOfDay(d), maxDate) ||
                  capacity === 0;
                const isSelected = isSameDay(d, new Date(date + "T00:00:00"));
                const isToday = isSameDay(d, new Date());

                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      if (!disabled) {
                        setDate(format(d, "yyyy-MM-dd"));
                        setTime("");
                        setDayChosen(true);
                      }
                    }}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center transition-colors leading-none gap-0.5",
                      !inMonth && "opacity-30",
                      disabled && "cursor-not-allowed",
                      isSelected && "bg-brand",
                      !isSelected && isToday && "border border-brand"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        disabled ? "text-muted/30" : "text-foreground",
                        isSelected && "text-white font-bold",
                        !isSelected && isToday && "text-brand font-bold"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {capacity !== null && inMonth && (
                      <span
                        className={cn(
                          "text-[9px] font-semibold",
                          isSelected
                            ? "text-white/80"
                            : capacity === 0
                              ? "text-danger/60"
                              : "text-success"
                        )}
                      >
                        {capacity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted mt-2 text-center">
              El número indica los cupos disponibles de cada día.
            </p>
          </div>
        )}

        {dayChosen &&
          (!dayAvail ? (
            <p className="text-sm text-muted text-center py-3 bg-surface rounded-xl border border-border">
              No hay horario para este día. Selecciona otro.
            </p>
          ) : busyLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted text-center py-3 bg-surface rounded-xl border border-border">
              Sin horarios disponibles este día. Prueba otra fecha.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Selecciona una hora
              </p>
              {holdError && <p className="text-xs text-danger">{holdError}</p>}
              <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => selectTime(s)}
                    className={cn(
                      "h-11 rounded-xl text-sm font-semibold border transition-colors",
                      time === s
                        ? "bg-brand border-brand text-white"
                        : "border-border text-foreground bg-surface active:bg-background"
                    )}
                  >
                    {fmtSlot(s)}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {holdActive && time && (
          <div className="flex items-center justify-center gap-2 bg-brand-light rounded-xl p-3 border border-brand/20">
            <Timer size={15} className="text-brand" />
            <p className="text-xs text-brand font-semibold">
              Tu horario está reservado por 0:{String(holdSecondsLeft).padStart(2, "0")}
            </p>
          </div>
        )}

        <button
          disabled={!time || !holdActive}
          onClick={() => setStep("confirm")}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold disabled:opacity-40"
        >
          Revisar y confirmar →
        </button>
      </div>
    );
  }

  // ── Render: confirm — full summary ─────────────────────────────────────────

  const grandTotal = servicePrice + cartTotal;

  return (
    <div className="space-y-5">
      <button onClick={resetToDatetime} className="flex items-center gap-2 text-sm text-muted">
        <ChevronLeft size={16} /> Volver
      </button>

      {holdActive && (
        <div className="flex items-center justify-center gap-2 bg-brand-light rounded-xl p-3 border border-brand/20">
          <Timer size={15} className="text-brand" />
          <p className="text-xs text-brand font-semibold">
            Tu horario está reservado por 0:{String(holdSecondsLeft).padStart(2, "0")}
          </p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Resumen de tu reserva
        </p>
        <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
          <SummaryRow label="Barbero" value="Amado" />
          <SummaryRow label="Servicio" value={service?.name ?? ""} />
          <SummaryRow label="Duración" value={`${service?.duration_minutes} minutos`} />
          <SummaryRow
            label="Fecha"
            value={format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
          />
          <SummaryRow label="Hora" value={fmtSlot(time)} />
          {discountPct > 0 ? (
            <>
              <SummaryRow label="Precio normal" value={`$${basePrice.toFixed(2)}`} />
              <SummaryRow
                label={`Descuento (${discountPct}% promo)`}
                value={`−$${(basePrice - servicePrice).toFixed(2)}`}
              />
            </>
          ) : (
            <SummaryRow label="Servicio" value={`$${servicePrice.toFixed(2)}`} />
          )}
          {cartItems.map(([id, q]) => {
            const p = products.find((pp) => pp.id === id);
            if (!p) return null;
            return (
              <SummaryRow
                key={id}
                label={`${q}× ${p.name}`}
                value={`$${(Number(p.price) * q).toFixed(2)}`}
              />
            );
          })}
          <SummaryRow label="Método de pago" value="En el local" />
          <div className="flex items-center justify-between px-4 py-3 gap-3 bg-brand-light">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-base font-black text-brand">${grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger text-center">{error}</p>}

      <button
        disabled={loading}
        onClick={handleConfirm}
        className="w-full h-12 rounded-xl bg-brand text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {loading ? "Reservando..." : "Confirmar cita"}
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right truncate capitalize">
        {value}
      </span>
    </div>
  );
}
