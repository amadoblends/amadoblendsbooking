import { cn } from "@/lib/utils";

const config = {
  confirmada:  { label: "Confirmada",  className: "bg-success-light text-success" },
  pendiente:   { label: "Pendiente",   className: "bg-warning-light text-warning" },
  completada:  { label: "Completada",  className: "bg-border text-muted" },
  cancelada:   { label: "Cancelada",   className: "bg-danger-light text-danger" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status as keyof typeof config] ?? config.pendiente;
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold shrink-0", c.className)}>
      {c.label}
    </span>
  );
}
