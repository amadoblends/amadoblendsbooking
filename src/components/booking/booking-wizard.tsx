"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isBefore, isAfter,
  startOfDay, addDays,
} from "date-fns";
import { es, enUS } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Check, Loader2, Scissors, Sparkles, User, Users,
  ShoppingBag, Minus, Plus, Timer, Wind, Droplet, CalendarDays, Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";
import {
  GUEST_RELATIONSHIPS, WEEK_LABELS, generateSlots, fmtSlot, slotToDate, toMins,
  type AvailDay, type BusyInterval, type GuestRelationship,
} from "@/lib/booking";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WizardServiceProduct {
  id: string;
  name: string;
  image_url: string | null;
  category: "dry" | "wet" | null;
}

export interface WizardService {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
  image_url: string | null;
  kind: "single" | "package";
  description?: string | null;
  included_names?: string[];
  service_products?: WizardServiceProduct[];
}

export interface WizardProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

export interface WizardPromotion {
  id: string;
  title: string;
  discount_percent: number;
  service_id: string | null;
  weekdays: number[];
  start_time: string | null;
  end_time: string | null;
  ends_on: string | null;
}

type Step = "service" | "forWho" | "extras" | "useProducts" | "date" | "time" | "summary";

const HOLD_SECONDS = 60;

function discountFor(
  promotions: WizardPromotion[],
  service: WizardService | null,
  dateStr: string,
  time: string
): number {
  if (!service || !dateStr) return 0;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const weekday = new Date(y, mo - 1, d).getDay();
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

// ── Component ──────────────────────────────────────────────────────────────

export function BookingWizard({
  clientId,
  ownerName,
  services,
  products,
  availability,
  promotions = [],
  bookingWindowDays,
  minNoticeMinutes,
  preselectedServiceId,
  startAsGuest = false,
}: {
  clientId: string;
  ownerName: string;
  services: WizardService[];
  products: WizardProduct[];
  availability: AvailDay[];
  promotions?: WizardPromotion[];
  bookingWindowDays: number;
  minNoticeMinutes: number;
  preselectedServiceId?: string;
  startAsGuest?: boolean;
}) {
  const router = useRouter();
  const { t, lang } = useT();
  const locale = lang === "en" ? enUS : es;

  const initService = preselectedServiceId
    ? (services.find((s) => s.id === preselectedServiceId) ?? null)
    : null;

  // ── State ────────────────────────────────────────────────────────────────
  // A service picked from the home screen skips straight past that step
  const [step, setStep] = useState<Step>(initService ? "forWho" : "service");
  const [forGuest, setForGuest] = useState(startAsGuest);
  const [relationship, setRelationship] = useState<GuestRelationship | null>(null);
  const [guestName, setGuestName] = useState("");
  const [service, setService] = useState<WizardService | null>(initService);
  const [tab, setTab] = useState<"single" | "package">("single");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [chosenProducts, setChosenProducts] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [time, setTime] = useState("");
  const [calCursor, setCalCursor] = useState(startOfMonth(new Date()));
  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [busyLoading, setBusyLoading] = useState(false);
  const [busyVersion, setBusyVersion] = useState(0);
  const [holdExpiresAt, setHoldExpiresAt] = useState<number | null>(null);
  const [holdLeft, setHoldLeft] = useState(HOLD_SECONDS);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, bookingWindowDays);
  const activeWeekdays = new Set(availability.filter((d) => d.is_active).map((d) => d.weekday));

  const singles = services.filter((s) => s.kind !== "package");
  const packages = services.filter((s) => s.kind === "package");

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0);
  const cartTotal = cartItems.reduce((a, [id, q]) => {
    const p = products.find((pp) => pp.id === id);
    return a + (p ? Number(p.price) * q : 0);
  }, 0);
  const cartCount = cartItems.reduce((a, [, q]) => a + q, 0);

  const discount = discountFor(promotions, service, date, time);
  const servicePrice = service ? service.price * (1 - discount / 100) : 0;
  const grandTotal = servicePrice + cartTotal;

  const availableUseProducts = service?.service_products ?? [];

  // Steps that actually apply to this booking
  const steps = useMemo<Step[]>(() => {
    const list: Step[] = ["service", "forWho"];
    if (products.length > 0) list.push("extras");
    if (availableUseProducts.length > 0) list.push("useProducts");
    list.push("date", "time", "summary");
    return list;
  }, [products.length, availableUseProducts.length]);

  const stepIndex = steps.indexOf(step);
  // Highest step the user has actually completed — they can revisit any of
  // these from the breadcrumb but can't jump ahead into unfilled ones
  const [maxReached, setMaxReached] = useState(initService ? 1 : 0);

  function goTo(target: Step) {
    const idx = steps.indexOf(target);
    if (idx === -1 || idx > maxReached) return;
    // Leaving the held slot frees it for everyone else
    if ((step === "time" || step === "summary") && idx < steps.indexOf("time")) releaseHold();
    setStep(target);
  }

  function goNext() {
    const next = steps[stepIndex + 1];
    if (!next) return;
    setMaxReached((m) => Math.max(m, stepIndex + 1));
    setStep(next);
  }

  function goBack() {
    const prev = steps[stepIndex - 1];
    if (prev) goTo(prev);
  }

  // ── Availability ─────────────────────────────────────────────────────────
  const dayAvail = useMemo(() => {
    const wd = new Date(date + "T00:00:00").getDay();
    return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
  }, [date, availability]);

  useEffect(() => {
    if (step !== "date" && step !== "time") return;
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
  }, [calCursor, step, busyVersion]);

  const slots = useMemo(() => {
    if (!dayAvail || !service) return [];
    return generateSlots(dayAvail, service.duration_minutes, minNoticeMinutes, date, busy);
  }, [dayAvail, service, date, minNoticeMinutes, busy]);

  const availFor = useCallback(
    (ds: string) => {
      const wd = new Date(ds + "T00:00:00").getDay();
      return availability.find((d) => d.weekday === wd && d.is_active) ?? null;
    },
    [availability]
  );

  const dayCapacity = useCallback(
    (d: Date): number | null => {
      if (!service) return null;
      if (!activeWeekdays.has(d.getDay())) return null;
      if (isBefore(startOfDay(d), today) || isAfter(startOfDay(d), maxDate)) return null;
      const ds = format(d, "yyyy-MM-dd");
      const av = availFor(ds);
      if (!av) return null;
      return generateSlots(av, service.duration_minutes, minNoticeMinutes, ds, busy).length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, busy, minNoticeMinutes, availFor]
  );

  // ── Slot hold ────────────────────────────────────────────────────────────
  const releaseHold = useCallback(() => {
    setHoldExpiresAt(null);
    createClient().rpc("release_my_holds").then(() => {});
  }, []);

  const releaseRef = useRef(releaseHold);
  releaseRef.current = releaseHold;
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
      setHoldLeft(left);
      if (left === 0) {
        setHoldExpiresAt(null);
        setTime("");
        setHoldError(t("booking.holdExpired"));
        setBusyVersion((v) => v + 1);
        setStep("time");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdExpiresAt]);

  async function pickTime(slot: string) {
    setHoldError(null);
    setTime(slot);
    const supabase = createClient();
    const [h, mi] = slot.split(":").map(Number);
    const startsAt = slotToDate(date, h * 60 + mi);
    const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 30) * 60000);
    const { data: holdId } = await supabase.rpc("hold_slot", {
      p_starts: startsAt.toISOString(),
      p_ends: endsAt.toISOString(),
    });
    if (!holdId) {
      setTime("");
      setHoldError(t("booking.slotTaken"));
      setBusyVersion((v) => v + 1);
      return;
    }
    setHoldExpiresAt(Date.now() + HOLD_SECONDS * 1000);
    setHoldLeft(HOLD_SECONDS);
    setStep("summary");
  }

  // ── Confirm ──────────────────────────────────────────────────────────────
  async function confirm() {
    if (!service || !time) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
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
        guest_name: forGuest ? guestName.trim() : null,
        guest_relationship: forGuest ? relationship : null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(insertError?.code === "23P01" ? t("booking.slotTaken") : t("booking.createFailed"));
      setLoading(false);
      if (insertError?.code === "23P01") setStep("time");
      return;
    }

    if (cartItems.length > 0) {
      await supabase.from("appointment_products").insert(
        cartItems.map(([productId, quantity]) => ({
          appointment_id: inserted.id,
          product_id: productId,
          quantity,
        }))
      );
    }
    if (chosenProducts.size > 0) {
      await supabase.from("appointment_service_products").insert(
        [...chosenProducts].map((productId) => ({
          appointment_id: inserted.id,
          product_id: productId,
        }))
      );
    }

    releaseHold();
    setLoading(false);
    setDone(true);
    router.refresh();
  }

  function restart() {
    setStep("forWho");
    setForGuest(false);
    setRelationship(null);
    setGuestName("");
    setService(null);
    setCart({});
    setChosenProducts(new Set());
    setTime("");
    setDone(false);
    setError(null);
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="space-y-5 py-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center">
            <Check size={36} className="text-success" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{t("booking.confirmed")}</h2>
        </div>

        <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
          {forGuest && <Row label={t("guest.name")} value={guestName} />}
          <Row label={t("booking.service")} value={service?.name ?? ""} />
          <Row
            label={t("booking.date")}
            value={format(new Date(date + "T00:00:00"), "EEEE d MMMM yyyy", { locale })}
          />
          <Row label={t("booking.time")} value={fmtSlot(time)} />
          <div className="flex items-center justify-between px-4 py-3 bg-brand-light">
            <span className="text-sm font-bold text-foreground">{t("booking.total")}</span>
            <span className="text-base font-black text-brand">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={restart}
            className="flex-1 h-13 rounded-2xl border border-border text-base font-semibold text-foreground"
          >
            {t("booking.anotherBooking")}
          </button>
          <button
            onClick={() => router.push("/citas")}
            className="flex-1 h-13 rounded-2xl bg-brand text-white text-base font-bold"
          >
            {t("nav.myBookings")}
          </button>
        </div>
      </div>
    );
  }

  // ── Shell with breadcrumb ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Breadcrumb
        steps={steps}
        current={stepIndex}
        maxReached={maxReached}
        onGo={goTo}
        t={t}
      />

      {stepIndex > 0 && (
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-[15px] font-medium text-muted h-9 -my-1"
        >
          <ChevronLeft size={18} /> {t("common.back")}
        </button>
      )}

      {/* ── 1. Who is it for ── */}
      {step === "forWho" && (
        <div className="space-y-3">
          <StepTitle title={t("booking.forWho")} hint={t("booking.forWhoHint")} />

          <button
            onClick={() => {
              setForGuest(false);
              setRelationship(null);
              setGuestName("");
              goNext();
            }}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-surface active:bg-background text-left"
          >
            <div className="w-11 h-11 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
              <User size={20} className="text-brand" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{t("booking.forMe")}</p>
              <p className="text-xs text-muted">{ownerName}</p>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          <button
            onClick={() => setForGuest(true)}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-colors",
              forGuest ? "border-brand bg-brand-light" : "border-border bg-surface active:bg-background"
            )}
          >
            <div className="w-11 h-11 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
              <Users size={20} className="text-brand" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{t("booking.forGuest")}</p>
              <p className="text-xs text-muted">{t("booking.forGuestHint")}</p>
            </div>
            <ChevronRight size={16} className="text-muted" />
          </button>

          {/* Guest details unfold inline */}
          {forGuest && (
            <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">{t("guest.forWho")}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {GUEST_RELATIONSHIPS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRelationship(r.value)}
                    className={cn(
                      "h-14 rounded-xl border text-xs font-semibold px-1 transition-colors",
                      relationship === r.value
                        ? "bg-brand border-brand text-white"
                        : "border-border bg-background text-foreground"
                    )}
                  >
                    {lang === "en" ? r.en : r.es}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={t("guest.name")}
                className="w-full h-14 px-4 rounded-2xl border border-border bg-background text-base text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
              />

              <button
                disabled={!relationship || guestName.trim().length < 2}
                onClick={goNext}
                className="w-full h-13 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40"
              >
                {t("booking.continue")} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Service ── */}
      {step === "service" && (
        <div className="space-y-3">
          <StepTitle title={t("booking.pickService")} />

          <div className="flex rounded-xl bg-surface border border-border p-1">
            {(["single", "package"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "flex-1 h-11 rounded-xl text-[15px] font-semibold transition-colors",
                  tab === k ? "bg-brand text-white" : "text-muted"
                )}
              >
                {k === "single" ? t("booking.services") : t("booking.combos")}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {(tab === "single" ? singles : packages).map((s) => {
              const isCombo = s.kind === "package";
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setService(s);
                    setChosenProducts(new Set());
                    setTime("");
                    goNext();
                  }}
                  className={cn(
                    "w-full flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-colors",
                    isCombo
                      ? "bg-gradient-to-br from-surface to-brand-light border-brand/40"
                      : "bg-surface border-border active:bg-background"
                  )}
                >
                  {s.image_url ? (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                      <Image src={s.image_url} alt={s.name} width={56} height={56} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center"
                      style={{ background: `${s.color}26` }}
                    >
                      {isCombo ? (
                        <Sparkles size={20} className="text-brand" />
                      ) : (
                        <Scissors size={20} style={{ color: s.color }} />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-base text-foreground">{s.name}</p>
                      {isCombo && (
                        <span className="text-[9px] font-black tracking-wide text-white bg-brand px-1.5 py-0.5 rounded-full uppercase">
                          Combo
                        </span>
                      )}
                    </div>
                    {isCombo && s.included_names?.length ? (
                      <p className="text-xs text-muted mt-0.5">{s.included_names.join(" + ")}</p>
                    ) : (
                      s.description && (
                        <p className="text-xs text-muted line-clamp-2 mt-0.5">{s.description}</p>
                      )
                    )}
                    <p className="text-xs text-muted mt-0.5">⏱ {s.duration_minutes} min</p>
                  </div>
                  <p className="text-lg font-black text-brand shrink-0">${s.price}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Extras to buy ── */}
      {step === "extras" && (
        <div className="space-y-3">
          <StepTitle title={t("booking.extras")} hint={t("booking.extrasHint")} />

          <div className="space-y-2">
            {products.map((p) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-surface rounded-2xl border border-border p-3"
                >
                  {p.image_url ? (
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                      <Image src={p.image_url} alt={p.name} width={44} height={44} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
                      <ShoppingBag size={17} className="text-brand/60" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted">${p.price}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] ?? 0) - 1) }))}
                      disabled={qty === 0}
                      className="w-8 h-8 rounded-full border border-border flex items-center justify-center disabled:opacity-30"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold text-foreground w-4 text-center">{qty}</span>
                    <button
                      onClick={() => setCart((c) => ({ ...c, [p.id]: (c[p.id] ?? 0) + 1 }))}
                      className="w-8 h-8 rounded-full bg-brand flex items-center justify-center"
                    >
                      <Plus size={14} className="text-white" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={goNext}
            className="w-full h-14 rounded-2xl bg-brand text-white font-bold text-base"
          >
            {cartCount > 0
              ? `${t("booking.continue")} · $${cartTotal.toFixed(2)}`
              : t("booking.skip")}
          </button>
        </div>
      )}

      {/* ── 4. Products to use during the visit ── */}
      {step === "useProducts" && (
        <div className="space-y-4">
          <StepTitle title={t("products.question")} hint={t("products.hint")} />

          <ProductGroup
            title={t("products.dry")}
            icon={<Wind size={13} />}
            products={availableUseProducts.filter((p) => p.category === "dry")}
            selected={chosenProducts}
            onToggle={(id) =>
              setChosenProducts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />
          <ProductGroup
            title={t("products.wet")}
            icon={<Droplet size={13} />}
            products={availableUseProducts.filter((p) => p.category === "wet")}
            selected={chosenProducts}
            onToggle={(id) =>
              setChosenProducts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />
          <ProductGroup
            title={t("products.other")}
            products={availableUseProducts.filter((p) => !p.category)}
            selected={chosenProducts}
            onToggle={(id) =>
              setChosenProducts((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
          />

          <button
            onClick={goNext}
            className="w-full h-14 rounded-2xl bg-brand text-white font-bold text-base"
          >
            {chosenProducts.size > 0 ? `${t("booking.continue")} (${chosenProducts.size})` : t("booking.skip")}
          </button>
        </div>
      )}

      {/* ── 5. Date ── */}
      {step === "date" && (
        <div className="space-y-3">
          <StepTitle title={t("booking.pickDate")} hint={t("booking.capacityHint")} />

          <div className="bg-surface rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between mb-3">
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

            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {WEEK_LABELS.map((w, i) => (
                <div key={i} className="text-center text-[11px] font-bold text-muted py-1.5">
                  {w}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {eachDayOfInterval({
                start: startOfWeek(startOfMonth(calCursor), { weekStartsOn: 1 }),
                end: endOfWeek(endOfMonth(calCursor), { weekStartsOn: 1 }),
              }).map((d) => {
                const inMonth = isSameMonth(d, calCursor);
                const capacity = dayCapacity(d);
                const disabled =
                  !activeWeekdays.has(d.getDay()) ||
                  isBefore(startOfDay(d), today) ||
                  isAfter(startOfDay(d), maxDate) ||
                  capacity === 0;
                const isSelected = isSameDay(d, new Date(date + "T00:00:00"));
                const isToday = isSameDay(d, new Date());

                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      if (disabled) return;
                      setDate(format(d, "yyyy-MM-dd"));
                      setTime("");
                      goNext();
                    }}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 leading-none transition-colors min-h-[46px]",
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
                          "text-[10px] font-bold",
                          isSelected ? "text-white/80" : capacity === 0 ? "text-danger/60" : "text-success"
                        )}
                      >
                        {capacity}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. Time ── */}
      {step === "time" && (
        <div className="space-y-3">
          <StepTitle
            title={t("booking.selectTime")}
            hint={format(new Date(date + "T00:00:00"), "EEEE d MMMM", { locale })}
          />

          {holdError && (
            <p className="text-xs text-danger text-center bg-danger-light rounded-xl py-2">
              {holdError}
            </p>
          )}

          {!dayAvail ? (
            <p className="text-sm text-muted text-center py-4 bg-surface rounded-xl border border-border">
              {t("booking.noSchedule")}
            </p>
          ) : busyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin text-muted" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted text-center py-4 bg-surface rounded-xl border border-border">
              {t("booking.noSlots")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5">
              {slots.map((s) => (
                <button
                  key={s}
                  onClick={() => pickTime(s)}
                  className="h-14 rounded-2xl text-base font-semibold border border-border text-foreground bg-surface active:bg-brand active:text-white active:border-brand transition-colors"
                >
                  {fmtSlot(s)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 7. Summary ── */}
      {step === "summary" && (
        <div className="space-y-4">
          <StepTitle title={t("booking.summary")} />

          {holdExpiresAt && (
            <div className="flex items-center justify-center gap-2 bg-brand-light rounded-xl p-3 border border-brand/20">
              <Timer size={15} className="text-brand" />
              <p className="text-xs text-brand font-semibold">
                {t("booking.heldFor")} 0:{String(holdLeft).padStart(2, "0")}
              </p>
            </div>
          )}

          <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
            <Row
              label={t("booking.forWhom")}
              value={
                forGuest
                  ? `${guestName} (${
                      GUEST_RELATIONSHIPS.find((r) => r.value === relationship)?.[lang] ?? ""
                    })`
                  : ownerName
              }
            />
            <Row label={t("booking.service")} value={service?.name ?? ""} />
            <Row label={t("booking.duration")} value={`${service?.duration_minutes} ${t("booking.minutes")}`} />
            <Row
              label={t("booking.date")}
              value={format(new Date(date + "T00:00:00"), "EEEE d MMMM yyyy", { locale })}
            />
            <Row label={t("booking.time")} value={fmtSlot(time)} />

            {chosenProducts.size > 0 && (
              <Row
                label={t("booking.productsToUse")}
                value={availableUseProducts
                  .filter((p) => chosenProducts.has(p.id))
                  .map((p) => p.name)
                  .join(", ")}
              />
            )}

            {discount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-success-light">
                <span className="text-sm font-semibold text-success">
                  {t("booking.discount")} −{discount}%
                </span>
                <span className="text-sm font-bold text-success">
                  −${(service!.price - servicePrice).toFixed(2)}
                </span>
              </div>
            )}

            {cartItems.map(([id, q]) => {
              const p = products.find((pp) => pp.id === id);
              if (!p) return null;
              return (
                <Row key={id} label={`${q}× ${p.name}`} value={`$${(Number(p.price) * q).toFixed(2)}`} />
              );
            })}

            <Row label={t("booking.payment")} value={t("booking.payAtShop")} />

            <div className="flex items-center justify-between px-4 py-3 bg-brand-light">
              <span className="text-sm font-bold text-foreground">{t("booking.total")}</span>
              <span className="text-base font-black text-brand">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-danger text-center">{error}</p>}

          <button
            disabled={loading}
            onClick={confirm}
            className="w-full h-14 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
            {loading ? t("common.saving") : t("booking.confirm")}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Building blocks ────────────────────────────────────────────────────────

function Breadcrumb({
  steps,
  current,
  maxReached,
  onGo,
  t,
}: {
  steps: Step[];
  current: number;
  maxReached: number;
  onGo: (s: Step) => void;
  t: (k: never) => string;
}) {
  const LABELS: Record<Step, string> = {
    service: "booking.crumbService",
    forWho: "booking.crumbWho",
    extras: "booking.crumbExtras",
    useProducts: "booking.crumbProducts",
    date: "booking.crumbDate",
    time: "booking.crumbTime",
    summary: "booking.crumbConfirm",
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5 py-1">
      {steps.map((s, i) => {
        const reachable = i <= maxReached;
        const isCurrent = i === current;
        return (
          <div key={s} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && <ChevronRight size={13} className="text-muted/40 shrink-0" />}
            <button
              onClick={() => reachable && onGo(s)}
              disabled={!reachable}
              className={cn(
                "flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                isCurrent
                  ? "bg-brand text-white"
                  : reachable
                    ? "bg-surface text-foreground active:bg-brand-light"
                    : "text-muted/40 cursor-not-allowed"
              )}
            >
              {i < current && <Check size={12} className="shrink-0" />}
              {t(LABELS[s] as never)}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground leading-snug">{title}</h2>
      {hint && <p className="text-[15px] text-muted mt-1 capitalize">{hint}</p>}
    </div>
  );
}

function ProductGroup({
  title,
  icon,
  products,
  selected,
  onToggle,
}: {
  title: string;
  icon?: React.ReactNode;
  products: WizardServiceProduct[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (products.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-muted uppercase tracking-wide flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => {
          const active = selected.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onToggle(p.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors",
                active ? "bg-brand-light border-brand" : "bg-surface border-border active:bg-background"
              )}
            >
              {p.image_url ? (
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                  <Image src={p.image_url} alt={p.name} width={36} height={36} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center shrink-0">
                  <ShoppingBag size={14} className="text-muted" />
                </div>
              )}
              <span
                className={cn(
                  "text-xs font-semibold flex-1 min-w-0 truncate",
                  active ? "text-brand" : "text-foreground"
                )}
              >
                {p.name}
              </span>
              {active && <Check size={14} className="text-brand shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 gap-3">
      <span className="text-[15px] text-muted shrink-0">{label}</span>
      <span className="text-[15px] font-semibold text-foreground text-right truncate capitalize">
        {value}
      </span>
    </div>
  );
}
