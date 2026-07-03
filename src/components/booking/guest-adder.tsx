"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { GuestForm, type GuestServiceOption } from "./guest-form";

interface AppointmentOption {
  id: string;
  starts_at: string;
  serviceName: string;
}

export function GuestAdder({
  appointments,
  services,
}: {
  appointments: AppointmentOption[];
  services: GuestServiceOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(
    appointments.length === 1 ? appointments[0].id : ""
  );
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="bg-success-light rounded-2xl border border-success/20 p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto">
          <Check size={22} className="text-success" />
        </div>
        <p className="text-sm font-semibold text-success">¡Invitado agregado a tu cita!</p>
        <button
          onClick={() => router.push("/citas")}
          className="inline-block bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
        >
          Ver mis reservas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pick appointment */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">
          ¿A cuál cita lo invitas?
        </p>
        {appointments.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            className={cn(
              "w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
              selected === a.id
                ? "border-brand bg-brand-light"
                : "border-border bg-surface active:bg-background"
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                selected === a.id ? "bg-brand" : "bg-background border border-border"
              )}
            >
              <Clock size={17} className={selected === a.id ? "text-white" : "text-muted"} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{a.serviceName}</p>
              <p className="text-xs text-muted capitalize">
                {format(new Date(a.starts_at), "EEEE d MMM", { locale: es })} ·{" "}
                {new Date(a.starts_at).toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {selected === a.id && <Check size={16} className="text-brand shrink-0" />}
          </button>
        ))}
      </div>

      {/* Guest form */}
      {selected && (
        <div className="bg-surface rounded-2xl border border-border p-4 space-y-3">
          <p className="font-semibold text-sm text-foreground">Datos del invitado</p>
          <GuestForm appointmentId={selected} services={services} onDone={() => setDone(true)} />
        </div>
      )}
    </div>
  );
}
