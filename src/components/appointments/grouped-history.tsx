"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronRight, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { relationshipLabel } from "@/lib/booking";

export interface HistoryAppointment {
  id: string;
  starts_at: string;
  status: string;
  price: number;
  serviceName: string;
  serviceColor: string;
  guestName: string | null;
  guestRelationship: string | null;
}

interface DayGroup {
  key: string;
  label: string;
  items: HistoryAppointment[];
}
interface MonthGroup {
  key: string;
  label: string;
  total: number;
  days: DayGroup[];
}
interface YearGroup {
  key: string;
  total: number;
  months: MonthGroup[];
}

function localKey(iso: string, part: "year" | "month" | "day") {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (part === "year") return String(y);
  if (part === "month") return `${y}-${m}`;
  return `${y}-${m}-${day}`;
}

export function GroupedHistory({ appointments }: { appointments: HistoryAppointment[] }) {
  // Newest year and its newest month start open; the rest collapsed
  const grouped = useMemo<YearGroup[]>(() => {
    const years = new Map<string, Map<string, Map<string, HistoryAppointment[]>>>();

    for (const a of appointments) {
      const y = localKey(a.starts_at, "year");
      const m = localKey(a.starts_at, "month");
      const d = localKey(a.starts_at, "day");
      if (!years.has(y)) years.set(y, new Map());
      const months = years.get(y)!;
      if (!months.has(m)) months.set(m, new Map());
      const days = months.get(m)!;
      if (!days.has(d)) days.set(d, []);
      days.get(d)!.push(a);
    }

    return [...years.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([yKey, months]) => {
        const monthGroups = [...months.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([mKey, days]) => {
            const dayGroups = [...days.entries()]
              .sort((a, b) => (a[0] < b[0] ? 1 : -1))
              .map(([dKey, items]) => ({
                key: dKey,
                label: format(new Date(dKey + "T00:00:00"), "EEEE d", { locale: es }),
                items: items.sort(
                  (x, y2) =>
                    new Date(y2.starts_at).getTime() - new Date(x.starts_at).getTime()
                ),
              }));
            return {
              key: mKey,
              label: format(new Date(mKey + "-01T00:00:00"), "MMMM", { locale: es }),
              total: dayGroups.reduce((s, d) => s + d.items.length, 0),
              days: dayGroups,
            };
          });
        return {
          key: yKey,
          total: monthGroups.reduce((s, m) => s + m.total, 0),
          months: monthGroups,
        };
      });
  }, [appointments]);

  const [openYears, setOpenYears] = useState<Set<string>>(
    () => new Set(grouped.length > 0 ? [grouped[0].key] : [])
  );
  const [openMonths, setOpenMonths] = useState<Set<string>>(
    () => new Set(grouped[0]?.months[0] ? [grouped[0].months[0].key] : [])
  );
  const [openDay, setOpenDay] = useState<string | null>(
    () => grouped[0]?.months[0]?.days[0]?.key ?? null
  );

  function toggle(set: Set<string>, key: string, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  if (appointments.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-8 bg-surface rounded-2xl border border-border">
        Aún no tienes citas en tu historial.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {grouped.map((year) => {
        const yearOpen = openYears.has(year.key);
        return (
          <div
            key={year.key}
            className="bg-surface rounded-2xl border border-border overflow-hidden"
          >
            {/* Year */}
            <button
              onClick={() => toggle(openYears, year.key, setOpenYears)}
              className="w-full flex items-center gap-2 px-4 py-3 active:bg-background"
            >
              {yearOpen ? (
                <ChevronDown size={16} className="text-brand shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-muted shrink-0" />
              )}
              <span className="flex-1 text-left font-bold text-foreground">{year.key}</span>
              <span className="text-xs text-muted">{year.total} citas</span>
            </button>

            {yearOpen && (
              <div className="border-t border-border">
                {year.months.map((month) => {
                  const monthOpen = openMonths.has(month.key);
                  return (
                    <div key={month.key}>
                      {/* Month */}
                      <button
                        onClick={() => toggle(openMonths, month.key, setOpenMonths)}
                        className="w-full flex items-center gap-2 pl-8 pr-4 py-2.5 active:bg-background"
                      >
                        {monthOpen ? (
                          <ChevronDown size={14} className="text-brand shrink-0" />
                        ) : (
                          <ChevronRight size={14} className="text-muted shrink-0" />
                        )}
                        <span className="flex-1 text-left text-sm font-semibold text-foreground capitalize">
                          {month.label}
                        </span>
                        <span className="text-[11px] text-muted">{month.total}</span>
                      </button>

                      {monthOpen && (
                        <div className="pb-1">
                          {month.days.map((day) => {
                            const dayOpen = openDay === day.key;
                            return (
                              <div key={day.key}>
                                {/* Day */}
                                <button
                                  onClick={() => setOpenDay(dayOpen ? null : day.key)}
                                  className={cn(
                                    "w-full flex items-center gap-2 pl-12 pr-4 py-2 active:bg-background",
                                    dayOpen && "bg-brand-light"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "flex-1 text-left text-xs font-medium capitalize",
                                      dayOpen ? "text-brand" : "text-muted"
                                    )}
                                  >
                                    {day.label}
                                  </span>
                                  <span className="text-[10px] text-muted">
                                    {day.items.length}
                                  </span>
                                </button>

                                {dayOpen && (
                                  <div className="px-3 pb-2 pt-1 space-y-1.5">
                                    {day.items.map((a) => (
                                      <Link
                                        key={a.id}
                                        href={`/citas/${a.id}`}
                                        className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2.5 active:bg-surface"
                                      >
                                        <span
                                          className="w-1 self-stretch rounded-full shrink-0"
                                          style={{ background: a.serviceColor }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-semibold text-foreground truncate">
                                            {a.serviceName}
                                          </p>
                                          <p className="text-xs text-muted">
                                            {new Date(a.starts_at).toLocaleTimeString([], {
                                              hour: "numeric",
                                              minute: "2-digit",
                                            })}
                                            {" · "}${a.price.toFixed(2)}
                                          </p>
                                          {a.guestName && (
                                            <p className="text-[10px] text-brand font-semibold flex items-center gap-1 mt-0.5">
                                              <UserPlus size={9} />
                                              {a.guestName} (
                                              {relationshipLabel(a.guestRelationship)})
                                            </p>
                                          )}
                                        </div>
                                        <StatusBadge status={a.status} />
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
