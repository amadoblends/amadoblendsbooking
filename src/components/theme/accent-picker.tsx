"use client";

import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccent } from "@/components/theme/accent-provider";

/**
 * Trying accent colours on the real app.
 *
 * A swatch grid rather than a colour wheel: the point isn't to invent a
 * colour, it's to compare eight candidates on actual screens. The change
 * lands instantly and everywhere, so the way to judge one is to pick it and
 * then go use the app for a minute.
 *
 * Temporary. Once one is chosen it becomes the default in globals.css and
 * this screen comes out — see lib/accents.
 */
export function AccentPicker() {
  const { accent, setAccent, all } = useAccent();

  return (
    <div className="bg-surface rounded-[var(--radius-card)] border border-border p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-[var(--radius-control)] bg-brand-light text-brand flex items-center justify-center shrink-0">
          <Palette size={17} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Color de acento</p>
          <p className="text-xs text-muted mt-0.5">
            Cambia botones, pestañas activas e iconos. No cambia los fondos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {all.map((a) => {
          const active = a.id === accent.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAccent(a.id)}
              aria-pressed={active}
              className={cn(
                "rounded-[var(--radius-control)] border p-2 flex flex-col items-center gap-1.5 transition-colors",
                active ? "border-foreground bg-background" : "border-border bg-background"
              )}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: a.brand }}
              >
                {active && <Check size={15} strokeWidth={3} style={{ color: a.on }} />}
              </span>
              <span className="text-[10px] font-semibold text-foreground leading-tight text-center">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Judged against the things it actually tints, not a swatch alone */}
      <div className="bg-background rounded-[var(--radius-control)] border border-border p-3 space-y-2.5">
        <p className="text-[10px] font-bold text-muted uppercase tracking-wide">Vista previa</p>
        <div className="flex items-center gap-2">
          <button className="h-9 px-4 rounded-[var(--radius-control)] bg-brand text-[var(--color-brand-on)] text-xs font-bold">
            Reservar
          </button>
          <span className="h-9 px-3 rounded-[var(--radius-control)] bg-brand-light text-brand text-xs font-bold flex items-center">
            Activo
          </span>
          <span className="h-9 px-3 rounded-[var(--radius-control)] border border-border text-muted text-xs font-semibold flex items-center">
            Inactivo
          </span>
        </div>
      </div>
    </div>
  );
}
