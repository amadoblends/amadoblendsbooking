"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths, subMonths, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, format,
  isSameMonth, isSameDay, isBefore, isAfter, startOfDay, addDays,
} from "date-fns";
import { es, enUS } from "date-fns/locale";
import { useT } from "@/components/i18n/language-provider";
import { ChevronLeft, ChevronRight, Loader2, CalendarClock, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { shopDateAt } from "@/lib/timezone";
import { notifyBookingRescheduled } from "@/lib/actions/notify";
import { cn } from "@/lib/utils";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

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
  start: number;
  end: number;
}

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

export function RescheduleClient({
  appointmentId,
  currentStartsAt,
  currentEndsAt,
  durationMinutes,
  availability,
  bookingWindowDays,
}: {
  appointmentId: string;
  currentStartsAt: string;
  currentEndsAt: string;
  durationMinutes: number;
  availability: AvailDay[];
  bookingWindowDays: number;
}) {
  const router = useRouter();
  // Day and month names follow the client's language
  const { lang } = useT();
  const locale = lang === "en" ? enUS : es;
  const current = new Date(currentStartsAt);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(current, "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(current));
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  const dayAvail = useMemo(() => {
    const wd = new Date(date + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }, [date, availability]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const supabase = createClient();
    // The shop's day, so the busy window matches the slots offered
    const dayStart = shopDateAt(date, "00:00");
    const dayEnd = new Date(dayStart.getTime() + 86_399_000);
    const ownStart = new Date(currentStartsAt).getTime();
    const ownEnd = new Date(currentEndsAt).getTime();
    supabase
      .rpc("get_busy_times", {
        p_start: dayStart.toISOString(),
        p_end: dayEnd.toISOString(),
      })
      .then(({ data }) => {
        if (!alive) return;
        setBusy(
          (data ?? [])
            .map((b: { starts_at: string; ends_at: string }) => ({
              start: new Date(b.starts_at).getTime(),
              end: new Date(b.ends_at).getTime(),
            }))
            .filter((b: BusyInterval) => !(b.start === ownStart && b.end === ownEnd))
        );
      });
    return () => {
      alive = false;
    };
  }, [date, open, currentStartsAt, currentEndsAt]);

  const slots = useMemo(() => {
    if (!dayAvail) return [];
    const start = toMins(dayAvail.start_time);
    const end = toMins(dayAvail.end_time);
    const step = dayAvail.slot_minutes;
    const bS = dayAvail.break_start_time ? toMins(dayAvail.break_start_time) : null;
    const bE = dayAvail.break_end_time ? toMins(dayAvail.break_end_time) : null;
    const [y, mo, d] = date.split("-").map(Number);
    const now = Date.now();
    const out: string[] = [];
    for (let t = start; t + durationMinutes <= end; t += step) {
      if (bS !== null && bE !== null && t < bE && t + durationMinutes > bS) continue;
      const sMs = new Date(y, mo - 1, d, Math.floor(t / 60), t % 60, 0).getTime();
      if (sMs < now) continue;
      const eMs = sMs + durationMinutes * 60000;
      if (busy.some((b) => sMs < b.end && eMs > b.start)) continue;
      out.push(fromMins(t));
    }
    return out;
  }, [dayAvail, date, busy, durationMinutes]);

  async function handleSave() {
    if (!time) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    // The shop's wall clock, not this device's — see lib/timezone
    const startsAt = shopDateAt(date, time);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60000);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pendiente",
      })
      .eq("id", appointmentId);

    if (updateError) {
      setError(
        updateError.code === "23P01"
          ? "Ese horario acaba de ocuparse. Elige otro."
          : "No se pudo reagendar. Intenta de nuevo."
      );
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    // Both sides get the new time; a mail failure can't undo the change
    notifyBookingRescheduled(appointmentId, currentStartsAt).catch(() => {});
    router.refresh();
  }

  if (done) {
    return (
      <div className="bg-success-light rounded-2xl border border-success/20 p-4 text-center space-y-1">
        <Check size={22} className="text-success mx-auto" />
        <p className="text-sm font-semibold text-success">¡Cita reagendada!</p>
        <p className="text-xs text-muted capitalize">
          {format(new Date(date + "T00:00:00"), lang === "en" ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", { locale })} ·{" "}
          {fmtSlot(time)}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-border bg-surface text-sm font-semibold text-foreground active:bg-background"
      >
        <CalendarClock size={16} /> Reagendar cita
      </button>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-foreground">Reagendar cita</p>
        <button
          onClick={() => {
            setOpen(false);
            setTime("");
          }}
          className="w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center"
        >
          <X size={13} />
        </button>
      </div>

      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCalCursor((c) => subMonths(c, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronLeft size={14} />
          </button>
          <p className="font-semibold text-sm text-foreground capitalize">
            {format(calCursor, "MMMM yyyy", { locale })}
          </p>
          <button
            onClick={() => setCalCursor((c) => addMonths(c, 1))}
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-0.5">
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
                  "aspect-square rounded-lg text-xs font-medium flex items-center justify-center",
                  !inMonth && "text-muted/30",
                  disabled && "text-muted/25 cursor-not-allowed",
                  !disabled && inMonth && "text-foreground",
                  isSelected && "bg-brand text-white font-bold"
                )}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slots */}
      {!dayAvail ? (
        <p className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border">
          No hay horario para este día.
        </p>
      ) : slots.length === 0 ? (
        <p className="text-xs text-muted text-center py-2 bg-background rounded-xl border border-border">
          Sin horarios libres este día.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {slots.map((s) => (
            <button
              key={s}
              onClick={() => setTime(s)}
              className={cn(
                "h-9 rounded-lg text-xs font-semibold border transition-colors",
                time === s
                  ? "bg-brand border-brand text-white"
                  : "border-border text-foreground bg-background active:bg-surface"
              )}
            >
              {fmtSlot(s)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-danger text-center">{error}</p>}

      <button
        disabled={!time || loading}
        onClick={handleSave}
        className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {loading ? "Guardando..." : "Confirmar nuevo horario"}
      </button>
    </div>
  );
}
