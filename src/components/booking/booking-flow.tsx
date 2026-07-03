"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, format,
  isSameMonth, isSameDay, isBefore, isAfter, startOfDay, addDays, addMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Check, Loader2, Scissors, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient as createBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  image_url: string | null;
  kind: "single" | "package";
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
    // Break window
    if (bS !== null && bE !== null && t < bE && t + durMins > bS) continue;
    // Min notice
    const slotStart = slotToDate(dateStr, t);
    if (isBefore(slotStart, nowPlusNotice)) continue;
    // Already-booked overlap
    const sMs = slotStart.getTime();
    const eMs = sMs + durMins * 60000;
    if (busy.some((b) => sMs < b.end && eMs > b.start)) continue;
    out.push(fromMins(t));
  }
  return out;
}

type Step = "service" | "datetime" | "confirm" | "success";
type Tab = "single" | "package";

// ── Component ──────────────────────────────────────────────────────────────────

export function BookingFlow({
  clientId,
  services,
  availability,
  bookingWindowDays,
  minNoticeMinutes,
  preselectedServiceId,
}: {
  clientId: string;
  services: Service[];
  availability: AvailDay[];
  bookingWindowDays: number;
  minNoticeMinutes: number;
  preselectedServiceId?: string;
}) {
  const router = useRouter();

  const initService = preselectedServiceId
    ? (services.find((s) => s.id === preselectedServiceId) ?? null)
    : null;

  const [step, setStep] = useState<Step>(initService ? "datetime" : "service");
  const [tab, setTab] = useState<Tab>("single");
  const [service, setService] = useState<Service | null>(initService);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(new Date()));
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  const singles = services.filter((s) => s.kind !== "package");
  const packages = services.filter((s) => s.kind === "package");
  const shown = tab === "single" ? singles : packages;

  const dayAvail = useMemo(() => {
    const wd = new Date(date + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }, [date, availability]);

  // Fetch busy intervals whenever the selected date changes
  useEffect(() => {
    if (step !== "datetime") return;
    let alive = true;
    setBusyLoading(true);
    const supabase = createBrowser();
    const [y, mo, d] = date.split("-").map(Number);
    const dayStart = new Date(y, mo - 1, d, 0, 0, 0);
    const dayEnd = new Date(y, mo - 1, d, 23, 59, 59);
    supabase
      .rpc("get_busy_times", {
        p_start: dayStart.toISOString(),
        p_end: dayEnd.toISOString(),
      })
      .then(({ data }) => {
        if (!alive) return;
        setBusy(
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
  }, [date, step]);

  const slots = useMemo(() => {
    if (!dayAvail || !service) return [];
    return generateSlots(dayAvail, service.duration_minutes, minNoticeMinutes, date, busy);
  }, [dayAvail, service, date, minNoticeMinutes, busy]);

  async function handleConfirm() {
    if (!service || !time) return;
    setLoading(true);
    setError(null);

    const supabase = createBrowser();
    const [h, mi] = time.split(":").map(Number);
    const startsAt = slotToDate(date, h * 60 + mi);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

    const { error: insertError } = await supabase.from("appointments").insert({
      client_id: clientId,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price,
      status: "pendiente",
    });

    if (insertError) {
      setError(
        insertError.code === "23P01"
          ? "Ese horario acaba de ocuparse. Elige otro."
          : "No se pudo crear la cita. Intenta de nuevo."
      );
      setLoading(false);
      if (insertError.code === "23P01") setStep("datetime");
    } else {
      setStep("success");
      setLoading(false);
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-14 space-y-5 text-center">
        <div className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center">
          <Check size={36} className="text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">¡Reserva confirmada!</h2>
          <p className="text-sm text-muted mt-1 capitalize">
            {format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })} ·{" "}
            {fmtSlot(time)}
          </p>
          <p className="text-sm text-muted">{service?.name}</p>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => {
              setStep("service");
              setService(null);
              setTime("");
            }}
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
      </div>
    );
  }

  // ── Service selection ──────────────────────────────────────────────────────

  if (step === "service") {
    return (
      <div className="space-y-4">
        {/* Tabs */}
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
          <div className="space-y-2">
            {shown.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setService(s);
                  setTime("");
                  setStep("datetime");
                }}
                className="w-full flex items-center gap-3 bg-surface rounded-2xl border border-border p-3.5 active:bg-background text-left"
              >
                {s.image_url ? (
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                    <Image
                      src={s.image_url}
                      alt={s.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center"
                    style={{ background: `${s.color}26` }}
                  >
                    {s.kind === "package" ? (
                      <Sparkles size={20} style={{ color: s.color }} />
                    ) : (
                      <Scissors size={20} style={{ color: s.color }} />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{s.name}</p>
                  <p className="text-xs text-muted">{s.duration_minutes} min</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-bold text-foreground">${s.price}</p>
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

  // ── Date & time ────────────────────────────────────────────────────────────

  if (step === "datetime") {
    return (
      <div className="space-y-5">
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

        {/* Calendar */}
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
              const disabled =
                !activeWeekdays.has(wd) ||
                isBefore(startOfDay(d), today) ||
                isAfter(startOfDay(d), maxDate);
              const isSelected = isSameDay(d, new Date(date + "T00:00:00"));
              const isToday = isSameDay(d, new Date());

              return (
                <button
                  key={d.toISOString()}
                  onClick={() => {
                    if (!disabled) {
                      setDate(format(d, "yyyy-MM-dd"));
                      setTime("");
                    }
                  }}
                  className={cn(
                    "aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-colors",
                    !inMonth && "text-muted/30",
                    disabled && "text-muted/25 cursor-not-allowed",
                    !disabled && inMonth && "text-foreground",
                    isSelected && "bg-brand text-white font-bold",
                    !isSelected && isToday && "border border-brand text-brand font-bold"
                  )}
                >
                  {format(d, "d")}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        {!dayAvail ? (
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
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => setTime(s)}
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
        )}

        <button
          disabled={!time}
          onClick={() => setStep("confirm")}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold disabled:opacity-40"
        >
          Continuar →
        </button>
      </div>
    );
  }

  // ── Confirm ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <button
        onClick={() => setStep("datetime")}
        className="flex items-center gap-2 text-sm text-muted"
      >
        <ChevronLeft size={16} /> Volver
      </button>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
        <SummaryRow label="Servicio" value={service?.name ?? ""} />
        <SummaryRow label="Duración" value={`${service?.duration_minutes} minutos`} />
        <SummaryRow
          label="Fecha"
          value={format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
        />
        <SummaryRow label="Hora" value={fmtSlot(time)} />
        <SummaryRow label="Precio" value={`$${service?.price.toFixed(2)}`} />
      </div>

      <div className="bg-brand-light rounded-xl p-3 border border-brand/20">
        <p className="text-xs text-brand font-semibold">
          ℹ️ El pago se realiza en el local al momento de la cita.
        </p>
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
