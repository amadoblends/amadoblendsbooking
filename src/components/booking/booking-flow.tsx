"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, format,
  isSameMonth, isSameDay, isBefore, isAfter, startOfDay, addDays, addMinutes,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Check, Loader2, Scissors } from "lucide-react";
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
function generateSlots(day: AvailDay, durMins: number, minNoticeMins: number, dateStr: string): string[] {
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
    // Check min notice
    const [y, mo, d] = dateStr.split("-").map(Number);
    const slotDate = new Date(y, mo - 1, d, Math.floor(t / 60), t % 60);
    if (isBefore(slotDate, nowPlusNotice)) continue;
    out.push(fromMins(t));
  }
  return out;
}

type Step = "service" | "datetime" | "confirm" | "success";

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
  const supabase = createBrowser();

  const initService = preselectedServiceId
    ? (services.find((s) => s.id === preselectedServiceId) ?? null)
    : null;

  const [step, setStep] = useState<Step>(initService ? "datetime" : "service");
  const [service, setService] = useState<Service | null>(initService);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  const dayAvail = useMemo(() => {
    const wd = new Date(date + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }, [date, availability]);

  const slots = useMemo(() => {
    if (!dayAvail || !service) return [];
    return generateSlots(dayAvail, service.duration_minutes, minNoticeMinutes, date);
  }, [dayAvail, service, date, minNoticeMinutes]);

  async function handleConfirm() {
    if (!service || !time) return;
    setLoading(true);
    setError(null);

    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    const startsAt = new Date(y, mo - 1, d, h, mi, 0).toISOString();
    const endsAt = new Date(y, mo - 1, d, h, mi + service.duration_minutes, 0).toISOString();

    const { error: insertError } = await supabase.from("appointments").insert({
      client_id: clientId,
      service_id: service.id,
      starts_at: startsAt,
      ends_at: endsAt,
      price: service.price,
      status: "pendiente",
    });

    if (insertError) {
      setError(
        insertError.code === "23P01"
          ? "Ese horario ya está ocupado. Elige otro."
          : "No se pudo crear la cita. Intenta de nuevo."
      );
      setLoading(false);
    } else {
      setStep("success");
    }
  }

  // ── Steps ──────────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
          <Check size={36} className="text-success" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">¡Cita reservada!</h2>
          <p className="text-sm text-muted mt-1">
            {format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })} · {fmtSlot(time)}
          </p>
          <p className="text-sm text-muted">{service?.name}</p>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button
            onClick={() => { setStep("service"); setService(null); setTime(""); }}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            Nueva cita
          </button>
          <button
            onClick={() => router.push("/citas")}
            className="flex-1 h-11 rounded-xl bg-brand text-white text-sm font-semibold"
          >
            Mis citas
          </button>
        </div>
      </div>
    );
  }

  if (step === "service") {
    return (
      <div className="space-y-3">
        {services.map((s) => (
          <button
            key={s.id}
            onClick={() => { setService(s); setTime(""); setStep("datetime"); }}
            className="w-full flex items-center gap-4 bg-surface rounded-2xl border border-border p-4 active:bg-background text-left"
          >
            {s.image_url ? (
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
                <Image src={s.image_url} alt={s.name} width={56} height={56} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${s.color}22` }}>
                <Scissors size={22} style={{ color: s.color }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{s.name}</p>
              <p className="text-sm text-muted">{s.duration_minutes} min</p>
            </div>
            <p className="text-base font-bold text-brand shrink-0">${s.price}</p>
          </button>
        ))}
      </div>
    );
  }

  if (step === "datetime") {
    return (
      <div className="space-y-5">
        <button onClick={() => setStep("service")} className="flex items-center gap-2 text-sm text-muted">
          <ChevronLeft size={16} /> Cambiar servicio
        </button>

        {/* Selected service summary */}
        <div className="bg-surface rounded-xl border border-border p-3 flex items-center gap-3">
          <div className="w-2 h-10 rounded-full shrink-0" style={{ background: service?.color }} />
          <div>
            <p className="font-semibold text-sm text-foreground">{service?.name}</p>
            <p className="text-xs text-muted">{service?.duration_minutes} min · ${service?.price}</p>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-surface rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCalCursor((c) => subMonths(c, 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <ChevronLeft size={14} />
            </button>
            <p className="font-semibold text-sm text-foreground capitalize">
              {format(calCursor, "MMMM yyyy", { locale: es })}
            </p>
            <button onClick={() => setCalCursor((c) => addMonths(c, 1))} className="w-8 h-8 rounded-full border border-border flex items-center justify-center">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEK_LABELS.map((w, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-muted py-1">{w}</div>
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
                  onClick={() => { if (!disabled) { setDate(format(d, "yyyy-MM-dd")); setTime(""); } }}
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
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted text-center py-3 bg-surface rounded-xl border border-border">
            Sin disponibilidad para este día. Prueba otra fecha.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Horarios disponibles</p>
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

  // step === "confirm"
  return (
    <div className="space-y-5">
      <button onClick={() => setStep("datetime")} className="flex items-center gap-2 text-sm text-muted">
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
      <span className="text-sm font-semibold text-foreground text-right truncate capitalize">{value}</span>
    </div>
  );
}
