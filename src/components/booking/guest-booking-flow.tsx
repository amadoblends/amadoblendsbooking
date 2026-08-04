"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isBefore, isAfter,
  startOfDay, addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Check, Loader2, Scissors, Sparkles, UserPlus,
  Users, CalendarDays,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  GUEST_RELATIONSHIPS, WEEK_LABELS, generateSlots, fmtSlot, slotToDate,
  type AvailDay, type BusyInterval, type GuestRelationship,
} from "@/lib/booking";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  image_url: string | null;
  kind: "single" | "package";
}

type Step = "relationship" | "name" | "service" | "datetime" | "confirm" | "done";

export function GuestBookingFlow({
  clientId,
  ownerName,
  services,
  availability,
  bookingWindowDays,
  minNoticeMinutes,
  onDone,
}: {
  clientId: string;
  ownerName: string;
  services: Service[];
  availability: AvailDay[];
  bookingWindowDays: number;
  minNoticeMinutes: number;
  onDone?: () => void;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("relationship");
  const [relationship, setRelationship] = useState<GuestRelationship | null>(null);
  const [guestName, setGuestName] = useState("");
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dayChosen, setDayChosen] = useState(false);
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(new Date()));
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  const dayAvail = useMemo(() => {
    const wd = new Date(date + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }, [date, availability]);

  useEffect(() => {
    if (step !== "datetime") return;
    let alive = true;
    setBusyLoading(true);
    const supabase = createClient();
    const gridStart = startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 });
    const gridEnd = addDays(endOfWeek(endOfMonth(calCursor), { weekStartsOn: 1 }), 1);
    supabase
      .rpc("get_busy_times", {
        p_start: gridStart.toISOString(),
        p_end: gridEnd.toISOString(),
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
  }, [calCursor, step]);

  const slots = useMemo(() => {
    if (!dayAvail || !service) return [];
    return generateSlots(dayAvail, service.duration_minutes, minNoticeMinutes, date, busy);
  }, [dayAvail, service, date, minNoticeMinutes, busy]);

  const availFor = useCallback(
    (dateStr: string) => {
      const wd = new Date(dateStr + "T00:00:00").getDay();
      return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
    },
    [availability]
  );

  // Remaining openings for the chosen service, shown under each day number
  const dayCapacity = useCallback(
    (d: Date): number | null => {
      if (!service) return null;
      if (!activeWeekdays.has(d.getDay())) return null;
      if (isBefore(startOfDay(d), today) || isAfter(startOfDay(d), maxDate)) return null;
      const ds = format(d, "yyyy-MM-dd");
      const avail = availFor(ds);
      if (!avail) return null;
      return generateSlots(avail, service.duration_minutes, minNoticeMinutes, ds, busy).length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, busy, minNoticeMinutes, availFor]
  );

  async function handleConfirm() {
    if (!service || !time || !relationship) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const [h, mi] = time.split(":").map(Number);
    const startsAt = slotToDate(date, h * 60 + mi);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60000);

    // The guest gets their own appointment, still tied to the owner's account
    const { error: insertError } = await supabase.from("appointments").insert({
      client_id: clientId,
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price: service.price,
      status: "pendiente",
      guest_name: guestName.trim(),
      guest_relationship: relationship,
    });

    if (insertError) {
      setError(
        insertError.code === "23P01"
          ? "Ese horario acaba de ocuparse. Elige otro."
          : "No se pudo crear la cita del invitado."
      );
      setLoading(false);
      if (insertError.code === "23P01") setStep("datetime");
      return;
    }

    setLoading(false);
    setStep("done");
    router.refresh();
  }

  function reset() {
    setStep("relationship");
    setRelationship(null);
    setGuestName("");
    setService(null);
    setTime("");
    setDayChosen(false);
    setError(null);
  }

  // ── Done ────────────────────────────────────────────────────────────────

  if (step === "done") {
    return (
      <div className="bg-success-light rounded-2xl border border-success/20 p-6 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <Check size={26} className="text-success" />
        </div>
        <div>
          <p className="font-bold text-success">¡Cita del invitado creada!</p>
          <p className="text-sm text-muted mt-1 capitalize">
            {guestName} · {format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}{" "}
            · {fmtSlot(time)}
          </p>
          <p className="text-xs text-muted mt-0.5">{service?.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            Otro invitado
          </button>
          <button
            onClick={() => (onDone ? onDone() : router.push("/citas"))}
            className="flex-1 h-11 rounded-xl bg-brand text-white text-sm font-semibold"
          >
            Mis reservas
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: relationship ────────────────────────────────────────────────

  if (step === "relationship") {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-3">
            <Users size={26} className="text-brand" />
          </div>
          <h2 className="font-bold text-foreground text-lg">¿La cita es para quién?</h2>
          <p className="text-sm text-muted mt-1">
            Se creará una cita aparte, ligada a tu cuenta.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {GUEST_RELATIONSHIPS.map((r) => (
            <button
              key={r.value}
              onClick={() => {
                setRelationship(r.value);
                setStep("name");
              }}
              className="h-16 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground active:bg-brand-light active:border-brand transition-colors px-1"
            >
              {r.es}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: name ────────────────────────────────────────────────────────

  if (step === "name") {
    const relLabel = GUEST_RELATIONSHIPS.find((r) => r.value === relationship)?.es ?? "";
    return (
      <div className="space-y-4">
        <button
          onClick={() => setStep("relationship")}
          className="flex items-center gap-2 text-sm text-muted"
        >
          <ChevronLeft size={16} /> Cambiar relación
        </button>

        <div className="bg-brand-light rounded-xl border border-brand/20 px-4 py-2.5">
          <p className="text-xs text-brand font-semibold">
            {relLabel} de {ownerName}
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-foreground mb-1.5 block">
            ¿Cómo se llama tu invitado?
          </label>
          <input
            type="text"
            autoFocus
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Ej. Juan Pérez"
            className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <button
          disabled={guestName.trim().length < 2}
          onClick={() => setStep("service")}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold disabled:opacity-40"
        >
          Continuar →
        </button>
      </div>
    );
  }

  // ── Step 3: service ─────────────────────────────────────────────────────

  if (step === "service") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setStep("name")}
          className="flex items-center gap-2 text-sm text-muted"
        >
          <ChevronLeft size={16} /> Volver
        </button>

        <p className="text-sm font-semibold text-foreground">
          ¿Qué servicio quiere {guestName.split(" ")[0]}?
        </p>

        <div className="space-y-2">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setService(s);
                setTime("");
                setDayChosen(false);
                setStep("datetime");
              }}
              className="w-full flex items-center gap-3 bg-surface rounded-2xl border border-border p-3.5 active:bg-background text-left"
            >
              {s.image_url ? (
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <Image
                    src={s.image_url}
                    alt={s.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ background: `${s.color}26` }}
                >
                  {s.kind === "package" ? (
                    <Sparkles size={18} style={{ color: s.color }} />
                  ) : (
                    <Scissors size={18} style={{ color: s.color }} />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{s.name}</p>
                <p className="text-xs text-muted">{s.duration_minutes} min</p>
              </div>
              <p className="text-sm font-bold text-brand shrink-0">${s.price}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 4: date & time ─────────────────────────────────────────────────

  if (step === "datetime") {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setStep("service")}
          className="flex items-center gap-2 text-sm text-muted"
        >
          <ChevronLeft size={16} /> Cambiar servicio
        </button>

        {dayChosen ? (
          <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <CalendarDays size={18} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground capitalize">
                {format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-xs text-muted">Ahora selecciona una hora</p>
            </div>
            <button
              onClick={() => {
                setDayChosen(false);
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
              No hay horario para este día.
            </p>
          ) : busyLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted text-center py-3 bg-surface rounded-xl border border-border">
              Sin horarios disponibles. Prueba otra fecha.
            </p>
          ) : (
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
          ))}

        <button
          disabled={!time}
          onClick={() => setStep("confirm")}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold disabled:opacity-40"
        >
          Revisar y confirmar →
        </button>
      </div>
    );
  }

  // ── Step 5: confirm ─────────────────────────────────────────────────────

  const relLabel = GUEST_RELATIONSHIPS.find((r) => r.value === relationship)?.es ?? "";

  return (
    <div className="space-y-4">
      <button
        onClick={() => setStep("datetime")}
        className="flex items-center gap-2 text-sm text-muted"
      >
        <ChevronLeft size={16} /> Volver
      </button>

      <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
        <Row label="Invitado" value={guestName} />
        <Row label="Relación" value={`${relLabel} de ${ownerName}`} />
        <Row label="Servicio" value={service?.name ?? ""} />
        <Row label="Duración" value={`${service?.duration_minutes} minutos`} />
        <Row
          label="Fecha"
          value={format(new Date(date + "T00:00:00"), "EEEE d 'de' MMMM yyyy", { locale: es })}
        />
        <Row label="Hora" value={fmtSlot(time)} />
        <div className="flex items-center justify-between px-4 py-3 gap-3 bg-brand-light">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-base font-black text-brand">
            ${(service?.price ?? 0).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="bg-brand-light rounded-xl p-3 border border-brand/20 flex items-start gap-2">
        <UserPlus size={15} className="text-brand shrink-0 mt-0.5" />
        <p className="text-xs text-brand">
          El barbero verá esta cita como <strong>{guestName} ({relLabel} de {ownerName})</strong>.
        </p>
      </div>

      {error && <p className="text-sm text-danger text-center">{error}</p>}

      <button
        disabled={loading}
        onClick={handleConfirm}
        className="w-full h-12 rounded-xl bg-brand text-white font-bold disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
        {loading ? "Creando..." : "Crear cita del invitado"}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <span className="text-sm text-muted shrink-0">{label}</span>
      <span className="text-sm font-semibold text-foreground text-right truncate capitalize">
        {value}
      </span>
    </div>
  );
}
