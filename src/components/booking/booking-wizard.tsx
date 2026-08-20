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
  ShoppingBag, Minus, Plus, Timer, Wind, Droplet, CalendarDays, Clock, Cake,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";
import {
  birthdayDiscount,
  DEFAULT_BIRTHDAY,
  type BirthdaySettings,
} from "@/lib/client-rules";
import {
  GUEST_RELATIONSHIPS, WEEK_LABELS, generateSlots, fmtSlot, slotToDate, toMins,
  type AvailDay, type BusyInterval, type GuestRelationship,
} from "@/lib/booking";
import {
  ClosureNotice,
  ClosureChip,
  closureForDate,
  type ClientClosure,
} from "./closure-notice";
import { saveDraft, loadDraft, clearDraft } from "@/lib/booking-draft";
import { shopToday } from "@/lib/timezone";
import {
  extraMinutesFor,
  categoryLabel,
  categoryEmoji,
  DEFAULT_CATEGORIES,
} from "@/lib/product-categories";
import { notifyBookingCreated } from "@/lib/actions/notify";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WizardServiceProduct {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  /** Minutes this product adds to the appointment when chosen. */
  extra_minutes?: number | null;
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
  starts_on?: string | null;
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

  const today = shopToday();

  let best = 0;
  for (const p of promotions) {
    if (p.service_id && p.service_id !== service.id) continue;
    if (!p.weekdays.includes(weekday)) continue;
    // The promotion has to be running *now* and still cover the booked day.
    // The old check looked only at ends_on vs the booking date, so a campaign
    // that hadn't started yet already discounted, and an expired one kept
    // discounting bookings made before its end date.
    if (p.starts_on && today < p.starts_on) continue;
    if (p.ends_on && today > p.ends_on) continue;
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
  slotIntervalMinutes,
  bufferMinutes = 0,
  optimizeGaps = false,
  closures = [],
  preselectedServiceId,
  startAsGuest = false,
  barberName = "Amado",
  barberAvatarUrl = null,
  shopAddress = null,
  clientBirthDate = null,
  birthdaySettings = DEFAULT_BIRTHDAY,
}: {
  clientId: string;
  ownerName: string;
  services: WizardService[];
  products: WizardProduct[];
  availability: AvailDay[];
  promotions?: WizardPromotion[];
  bookingWindowDays: number;
  minNoticeMinutes: number;
  slotIntervalMinutes?: number;
  bufferMinutes?: number;
  optimizeGaps?: boolean;
  closures?: ClientClosure[];
  preselectedServiceId?: string;
  startAsGuest?: boolean;
  barberName?: string;
  barberAvatarUrl?: string | null;
  shopAddress?: string | null;
  /** Used for the birthday discount; null when they never gave it. */
  clientBirthDate?: string | null;
  birthdaySettings?: BirthdaySettings;
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
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  // Tapping a closed day explains why instead of just being greyed out
  const [openClosure, setOpenClosure] = useState<ClientClosure | null>(null);
  // Shown when a restored booking's chosen time was taken while they were away
  const [slotLostNotice, setSlotLostNotice] = useState(false);
  // The 60-second hold ran out while they were on the summary step
  const [sessionExpired, setSessionExpired] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

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
  const promoPrice = service ? service.price * (1 - discount / 100) : 0;

  /*
   * The birthday comes off after the promotion, not instead of it — the
   * banner on the home screen promises a birthday discount, so it has to
   * survive whatever promotion is also running. It's computed against the
   * appointment's own date, so booking a week out doesn't quietly grant a
   * discount that will have expired by the time they sit down.
   */
  const birthdayOff = service
    ? birthdayDiscount(promoPrice, service.id, clientBirthDate, birthdaySettings, date)
    : 0;
  const servicePrice = Math.max(0, promoPrice - birthdayOff);
  const grandTotal = servicePrice + cartTotal;

  const availableUseProducts = service?.service_products ?? [];

  /*
   * Some products lengthen the visit — an enhancement adds four minutes, a
   * colour ten. That has to be the duration everything downstream uses:
   * which slots are offered, how far ahead the day fills, the hold, the
   * appointment's end time and therefore overlap prevention. Showing it only
   * on the confirmation would let two bookings collide.
   *
   * The service's own duration is never modified — this is per booking.
   */
  const extraMinutes = useMemo(
    () => extraMinutesFor(availableUseProducts, chosenProducts),
    [availableUseProducts, chosenProducts]
  );
  const effectiveDuration = (service?.duration_minutes ?? 0) + extraMinutes;

  /** Products the service offers, bucketed by their category. */
  const groupedUseProducts = useMemo(() => {
    const map = new Map<string, WizardServiceProduct[]>();
    for (const p of availableUseProducts) {
      const key = p.category ?? "other";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    // Follow the catalogue's own order, with anything unknown last
    const order = DEFAULT_CATEGORIES.map((c) => c.id);
    return [...map.entries()].sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 999 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 999 : order.indexOf(b[0]))
    );
  }, [availableUseProducts]);

  const toggleUseProduct = useCallback((id: string) => {
    setChosenProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Shared slot rules from the barber's booking settings
  const slotOptions = useMemo(
    () => ({
      intervalMinutes: slotIntervalMinutes,
      bufferMinutes,
      optimizeGaps,
      // The calendar already greys closed days out; passing them here means
      // the times themselves agree, so a closure can't leave a bookable hour
      // behind on a shut afternoon.
      closures,
    }),
    [slotIntervalMinutes, bufferMinutes, optimizeGaps, closures]
  );

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

  // ── Draft: survive an accidental exit ────────────────────────────────────
  /*
   * Restore once, on mount. A service chosen from the home screen wins over a
   * stored draft, since that's a deliberate fresh start.
   */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (preselectedServiceId) {
      clearDraft();
      return;
    }

    const draft = loadDraft();
    if (!draft) return;

    const svc = services.find((s) => s.id === draft.serviceId);
    if (!svc) {
      // The service was deleted or hidden while they were away
      clearDraft();
      return;
    }

    setService(svc);
    setForGuest(draft.forGuest);
    setRelationship((draft.relationship as GuestRelationship | null) ?? null);
    setGuestName(draft.guestName);
    setTab(draft.tab);
    setCart(draft.cart ?? {});
    setChosenProducts(new Set(draft.chosenProducts ?? []));
    setMaxReached(draft.maxReached ?? 0);

    // A date in the past while they were away is no longer bookable
    const stillAhead = draft.date >= format(new Date(), "yyyy-MM-dd");
    setDate(stillAhead ? draft.date : format(new Date(), "yyyy-MM-dd"));
    setCalCursor(startOfMonth(new Date((stillAhead ? draft.date : format(new Date(), "yyyy-MM-dd")) + "T00:00:00")));

    // The hold was released when they left, so the time must be re-verified
    // below once the busy list loads. Never jump straight to the summary.
    setTime(stillAhead ? draft.time : "");
    setStep(draft.step === "summary" ? "time" : (draft.step as Step));
    setDraftRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every meaningful change
  useEffect(() => {
    if (done) return;
    saveDraft({
      step,
      forGuest,
      relationship,
      guestName,
      serviceId: service?.id ?? null,
      tab,
      cart,
      chosenProducts: [...chosenProducts],
      date,
      time,
      maxReached,
    });
  }, [
    step, forGuest, relationship, guestName, service, tab, cart,
    chosenProducts, date, time, maxReached, done,
  ]);

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
    return generateSlots(dayAvail, effectiveDuration, minNoticeMinutes, date, busy, slotOptions);
  // effectiveDuration must be a dependency: picking a product that adds time
  // changes which slots still fit.
  }, [dayAvail, service, date, minNoticeMinutes, busy, effectiveDuration, slotOptions]);

  /*
   * A restored booking proposes a time nobody was holding. Once the real
   * availability arrives, confirm the slot is still there — and if someone
   * else took it, say so plainly and send them back to pick another.
   */
  useEffect(() => {
    if (!draftRestored || busyLoading || !service || !time) return;
    setDraftRestored(false);
    if (slots.includes(time)) return;
    setTime("");
    setStep("time");
    setSlotLostNotice(true);
  }, [draftRestored, busyLoading, service, time, slots]);

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
      return generateSlots(av, effectiveDuration, minNoticeMinutes, ds, busy, slotOptions).length;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [service, busy, minNoticeMinutes, availFor, effectiveDuration]
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
        /*
         * The hold is gone, so the chosen time is no longer theirs. Send them
         * back to the Date step rather than leaving them staring at a list of
         * times where one is still highlighted — from there they re-pick the
         * day and hour deliberately, against fresh availability.
         */
        setHoldExpiresAt(null);
        setTime("");
        releaseRef.current();
        setSessionExpired(true);
        setHoldError(null);
        setBusyVersion((v) => v + 1);
        setStep("date");
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
    const endsAt = new Date(startsAt.getTime() + (effectiveDuration || 30) * 60000);
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
    const endsAt = new Date(startsAt.getTime() + effectiveDuration * 60000);

    const { data: inserted, error: insertError } = await supabase
      .from("appointments")
      .insert({
        client_id: clientId,
        service_id: service.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price: servicePrice,
        // Recorded so a later change to a product's minutes can't silently
        // rewrite what this appointment was booked as
        extra_minutes: extraMinutes,
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

    // Short human-readable code from the appointment id
    setConfirmationCode(inserted.id.replace(/-/g, "").slice(0, 6).toUpperCase());

    releaseHold();
    // The booking exists now, so there's nothing left to resume
    clearDraft();
    setLoading(false);
    setDone(true);

    /*
     * Confirmation emails and the barber's notification go out after the
     * screen has already switched. The booking is committed either way, so a
     * slow or misconfigured mail provider must never make the client wait or
     * think it failed.
     */
    notifyBookingCreated(inserted.id).catch(() => {});
    router.refresh();
  }

  function restart() {
    clearDraft();
    setStep("service");
    setForGuest(false);
    setRelationship(null);
    setGuestName("");
    setService(null);
    setCart({});
    setChosenProducts(new Set());
    setTime("");
    setMaxReached(0);
    setDone(false);
    setError(null);
    setSlotLostNotice(false);
  }

  // ── Done screen ──────────────────────────────────────────────────────────
  if (done) {
    const endMins = toMins(time) + effectiveDuration;
    const endLabel = fmtSlot(
      `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`
    );

    return (
      <div className="py-4 space-y-6">
        {/* Confirmation mark */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative">
            <span className="absolute inset-0 rounded-full bg-success/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-success flex items-center justify-center">
              <Check size={38} className="text-white" strokeWidth={3} />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t("booking.confirmed")}</h2>
            <p className="text-[15px] text-muted mt-1">{t("booking.confirmedHint")}</p>
          </div>
          {confirmationCode && (
            <span className="font-mono text-sm font-bold tracking-widest text-foreground bg-surface border border-border rounded-full px-4 py-1.5">
              #{confirmationCode}
            </span>
          )}
        </div>

        {/* Barber */}
        <div className="bg-surface rounded-2xl border border-border p-4 flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 bg-brand-light flex items-center justify-center relative">
            {barberAvatarUrl ? (
              <Image src={barberAvatarUrl} alt={barberName} fill className="object-cover" sizes="56px" />
            ) : (
              <Scissors size={22} className="text-brand" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted uppercase tracking-wide">{t("booking.barber")}</p>
            <p className="font-bold text-foreground text-lg leading-tight">{barberName}</p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden divide-y divide-border">
          <Row
            label={t("booking.forWhom")}
            value={forGuest ? guestName : ownerName}
          />
          <Row label={t("booking.service")} value={service?.name ?? ""} />
          <Row
            label={t("booking.date")}
            value={format(new Date(date + "T00:00:00"), "EEEE d MMMM yyyy", { locale })}
          />
          <Row label={t("booking.time")} value={`${fmtSlot(time)} – ${endLabel}`} />
          <Row
            label={t("booking.duration")}
            // Shows the sum when a product lengthened the visit, so the client
            // isn't surprised by an end time that doesn't match the service
            value={
              extraMinutes > 0
                ? `${effectiveDuration} ${t("booking.minutes")} (${service?.duration_minutes} + ${extraMinutes})`
                : `${effectiveDuration} ${t("booking.minutes")}`
            }
          />
          {shopAddress && <Row label={t("booking.location")} value={shopAddress} />}
          <Row label={t("booking.payment")} value={t("booking.payAtShop")} />
          <div className="flex items-center justify-between px-4 py-3.5 bg-brand-light">
            <span className="text-[15px] font-bold text-foreground">{t("booking.total")}</span>
            <span className="text-lg font-black text-brand">${grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Primary action, then quiet links */}
        <div className="space-y-3">
          <button
            onClick={() => router.push("/")}
            className="w-full h-14 rounded-2xl bg-brand text-white font-bold text-base"
          >
            {t("booking.backHome")}
          </button>

          <div className="flex items-center justify-center gap-5">
            <button
              onClick={() => router.push("/citas")}
              className="text-sm font-semibold text-muted underline underline-offset-4 decoration-border"
            >
              {t("nav.myBookings")}
            </button>
            <button
              onClick={restart}
              className="text-sm font-semibold text-muted underline underline-offset-4 decoration-border"
            >
              {t("booking.anotherBooking")}
            </button>
          </div>
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

          {/*
            * Grouped by whatever categories the barber actually used, rather
            * than a hardcoded dry/wet pair — adding "Tinte" in the panel has
            * to show up here without a code change.
            */}
          {groupedUseProducts.map(([categoryId, items]) => (
            <ProductGroup
              key={categoryId}
              title={`${categoryEmoji(categoryId)} ${categoryLabel(categoryId, lang)}`}
              products={items}
              selected={chosenProducts}
              onToggle={toggleUseProduct}
            />
          ))}

          {/* Only worth saying once the choice actually costs time */}
          {extraMinutes > 0 && (
            <p className="text-xs text-muted bg-surface border border-border rounded-xl px-3.5 py-2.5 flex items-center gap-2">
              <Timer size={14} className="text-brand shrink-0" />
              {t("products.addsTime")
                .replace("{min}", String(extraMinutes))
                .replace("{total}", String(effectiveDuration))}
            </p>
          )}

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

          {/* The hold ran out, so the time they had is released */}
          {sessionExpired && (
            <div className="bg-warning-light border border-warning/25 rounded-2xl px-3.5 py-3 flex gap-2.5">
              <Timer size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-warning">{t("booking.sessionExpired")}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t("booking.sessionExpiredHint")}
                </p>
              </div>
              <button
                onClick={() => setSessionExpired(false)}
                aria-label="Cerrar aviso"
                className="text-muted shrink-0 self-start"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>
          )}

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
                const dayKey = format(d, "yyyy-MM-dd");
                const inMonth = isSameMonth(d, calCursor);
                const capacity = dayCapacity(d);
                const closed = closureForDate(dayKey, closures);
                /*
                 * Only a whole-day closure closes the day. An afternoon
                 * closure used to grey out the morning too, hiding hours that
                 * were genuinely bookable; the capacity check below already
                 * removes the day if nothing actually fits.
                 */
                const disabled =
                  closed?.all_day === true ||
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
                      // A day that can't be booked explains why rather than
                      // doing nothing when tapped
                      if (closed && (closed.all_day || capacity === 0)) {
                        setOpenClosure(closed);
                        return;
                      }
                      if (disabled) return;
                      setDate(dayKey);
                      setTime("");
                      goNext();
                    }}
                    className={cn(
                      "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 leading-none transition-colors min-h-[46px]",
                      !inMonth && "opacity-30",
                      disabled && !closed && "cursor-not-allowed",
                      closed && "bg-danger-light",
                      isSelected && "bg-brand",
                      !isSelected && isToday && "border border-brand"
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-medium",
                        disabled ? "text-muted/30" : "text-foreground",
                        closed && "text-danger/70",
                        isSelected && "text-white font-bold",
                        !isSelected && isToday && "text-brand font-bold"
                      )}
                    >
                      {format(d, "d")}
                    </span>
                    {closed && inMonth ? (
                      <ClosureChip reason={closed.reason} lang={lang} />
                    ) : (
                      capacity !== null &&
                      inMonth && (
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            isSelected
                              ? "text-white/80"
                              : capacity === 0
                                ? "text-danger/60"
                                : "text-success"
                          )}
                        >
                          {capacity}
                        </span>
                      )
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

          {/* The slot they had picked before leaving was taken meanwhile */}
          {slotLostNotice && (
            <div className="bg-warning-light border border-warning/25 rounded-2xl px-3.5 py-3 flex gap-2.5">
              <Clock size={16} className="text-warning shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-warning">
                  Esa hora ya fue reservada
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Alguien la tomó mientras no estabas. Elige otra hora disponible; el
                  resto de tu reserva se conservó.
                </p>
              </div>
              <button
                onClick={() => setSlotLostNotice(false)}
                aria-label="Cerrar aviso"
                className="text-muted shrink-0 self-start"
              >
                <Plus size={16} className="rotate-45" />
              </button>
            </div>
          )}

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
            <Row
              label={t("booking.duration")}
              value={
                extraMinutes > 0
                  ? `${effectiveDuration} ${t("booking.minutes")} (${service?.duration_minutes} + ${extraMinutes})`
                  : `${effectiveDuration} ${t("booking.minutes")}`
              }
            />
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
                  −${(service!.price - promoPrice).toFixed(2)}
                </span>
              </div>
            )}

            {/* Listed on its own line so it's clear it stacked on top */}
            {birthdayOff > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-brand-light">
                <span className="text-sm font-semibold text-brand flex items-center gap-1.5">
                  <Cake size={14} />
                  {t("birthday.discountApplied")}
                </span>
                <span className="text-sm font-bold text-brand">
                  −${birthdayOff.toFixed(2)}
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

      <ClosureNotice
        closure={openClosure}
        returnDate={openClosure ? nextOpenDay(openClosure, activeWeekdays, closures) : null}
        onClose={() => setOpenClosure(null)}
        lang={lang}
      />
    </div>
  );
}

/** First working day after a closure ends, skipping days off and other
 *  closures — so the client is never told to come back on a closed day. */
function nextOpenDay(
  closure: ClientClosure,
  activeWeekdays: Set<number>,
  closures: ClientClosure[]
): Date | null {
  if (activeWeekdays.size === 0) return null;
  const last = new Date(closure.ends_on + "T00:00:00");

  for (let i = 1; i <= 60; i++) {
    const candidate = addDays(last, i);
    if (!activeWeekdays.has(candidate.getDay())) continue;
    const key = format(candidate, "yyyy-MM-dd");
    if (closures.some((c) => key >= c.starts_on && key <= c.ends_on)) continue;
    return candidate;
  }
  return null;
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
