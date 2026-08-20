"use client";

import { format } from "date-fns";
import { es, enUS } from "date-fns/locale";
import { CalendarOff } from "lucide-react";
import { Modal } from "@/components/ui/modal";

export interface ClientClosure {
  id: string;
  starts_on: string;
  ends_on: string;
  reason: string;
  description: string | null;
  /**
   * A closure can shut the whole day or only part of it. Without these the
   * client's app treated an afternoon closure as if the shop were shut all
   * day, hiding a morning that was genuinely bookable.
   */
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
}

const REASON_LABELS: Record<string, { es: string; en: string; emoji: string }> = {
  vacaciones: { es: "Vacaciones", en: "Vacation", emoji: "🌴" },
  personal: { es: "Día personal", en: "Personal day", emoji: "🏠" },
  enfermedad: { es: "Enfermedad", en: "Sick day", emoji: "🤒" },
  feriado: { es: "Día feriado", en: "Holiday", emoji: "📅" },
  evento: { es: "Evento", en: "Event", emoji: "🎪" },
  capacitacion: { es: "Capacitación", en: "Training", emoji: "🎓" },
  mantenimiento: { es: "Mantenimiento", en: "Maintenance", emoji: "🔧" },
  otro: { es: "Cerrado", en: "Closed", emoji: "📌" },
};

export function closureLabel(reason: string, lang: "es" | "en" = "es") {
  return (REASON_LABELS[reason] ?? REASON_LABELS.otro)[lang];
}

export function closureEmoji(reason: string) {
  return (REASON_LABELS[reason] ?? REASON_LABELS.otro).emoji;
}

/** Finds the closure covering a day, if any. */
export function closureForDate(dateStr: string, closures: ClientClosure[]) {
  return closures.find((c) => dateStr >= c.starts_on && dateStr <= c.ends_on) ?? null;
}

export function ClosureNotice({
  closure,
  returnDate,
  onClose,
  lang = "es",
}: {
  closure: ClientClosure | null;
  returnDate: Date | null;
  onClose: () => void;
  lang?: "es" | "en";
}) {
  const locale = lang === "en" ? enUS : es;
  if (!closure) return null;

  const label = closureLabel(closure.reason, lang);
  const emoji = closureEmoji(closure.reason);
  const single = closure.starts_on === closure.ends_on;

  const range = single
    ? format(new Date(closure.starts_on + "T00:00:00"), "EEEE d 'de' MMMM", { locale })
    : `${format(new Date(closure.starts_on + "T00:00:00"), "d 'de' MMMM", { locale })} – ${format(
        new Date(closure.ends_on + "T00:00:00"),
        "d 'de' MMMM",
        { locale }
      )}`;

  return (
    <Modal open onClose={onClose} title={lang === "en" ? "Not available" : "No disponible"}>
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger-light flex items-center justify-center mx-auto text-2xl">
          {emoji}
        </div>

        <div>
          <p className="text-lg font-bold text-foreground">{label}</p>
          <p className="text-sm text-muted mt-1 capitalize">{range}</p>
        </div>

        {closure.description && (
          <p className="text-sm text-foreground bg-background rounded-xl border border-border px-4 py-3">
            {closure.description}
          </p>
        )}

        {returnDate && (
          <div className="bg-success-light rounded-xl border border-success/20 px-4 py-3">
            <p className="text-sm font-semibold text-success capitalize">
              {lang === "en" ? "Back on " : "Estaré de vuelta el "}
              {/* The Spanish "de" has no English twin — one pattern each */}
              {format(returnDate, lang === "en" ? "EEEE, MMMM d" : "EEEE d 'de' MMMM", {
                locale,
              })}
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full h-12 rounded-xl bg-brand text-white font-semibold text-sm"
        >
          {lang === "en" ? "Pick another date" : "Elegir otra fecha"}
        </button>
      </div>
    </Modal>
  );
}

/** Small inline chip used on the calendar day cell. */
export function ClosureChip({ reason, lang = "es" }: { reason: string; lang?: "es" | "en" }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-danger uppercase leading-none">
      <CalendarOff size={7} className="shrink-0" />
      {closureLabel(reason, lang)}
    </span>
  );
}
