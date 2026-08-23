import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * A titled block of settings rows.
 *
 * ── Why grouped rather than one long list ────────────────────────────────
 * Twelve rows in a single card is a wall — nothing stands out and everything
 * has to be read. Three short groups with a quiet label above each let the
 * eye skip to the one it wants. The label is 11px muted uppercase on the
 * page background, not inside the card, so it separates without adding
 * another box.
 */
export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-bold text-muted uppercase tracking-wide px-1">
        {title}
      </h2>
      <div className="bg-surface rounded-[var(--radius-card)] border border-border divide-y divide-border overflow-hidden">
        {children}
      </div>
    </section>
  );
}

/** One row: icon, label, optional current value, chevron. */
export function SettingsRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 h-[52px] active:bg-background"
    >
      <span className="shrink-0 text-muted">{icon}</span>
      <span className="flex-1 text-[14px] font-medium text-foreground">{label}</span>
      {value && <span className="text-[13px] text-muted shrink-0">{value}</span>}
      <ChevronRight size={16} className="text-muted shrink-0" />
    </Link>
  );
}
