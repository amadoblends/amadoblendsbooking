import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Calendar,
  Scissors,
  Pencil,
  Globe,
  Bell,
  Mail,
  Phone,
  MessageSquare,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { SignOutButton } from "@/components/profile/sign-out-button";
import { AccentPicker } from "@/components/theme/accent-picker";
import { LANGUAGES } from "@/lib/i18n";
import { getT } from "@/lib/session";

export default async function PerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, first_name, last_name, phone, email, avatar_url, language, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const { count: totalApts } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("client_id", client.id)
    .neq("status", "cancelada");

  const displayName =
    [client.first_name, client.last_name].filter(Boolean).join(" ") || client.full_name;

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const lang = LANGUAGES.find((l) => l.code === (client.language ?? "es"));
  const { t } = await getT();

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-4 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <h1 className="text-xl font-bold text-foreground">{t("profile.title")}</h1>
        </div>
        <Link
          href="/perfil/editar"
          className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center"
          aria-label="Editar perfil"
        >
          <Pencil size={17} className="text-brand" />
        </Link>
      </header>

      {/* Identity card */}
      <div className="bg-surface rounded-2xl border border-border p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center shrink-0 relative overflow-hidden">
          {client.avatar_url ? (
            <Image src={client.avatar_url} alt="" fill className="object-cover" />
          ) : (
            <span className="text-xl font-bold text-brand">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-lg truncate">{displayName}</p>
          <p className="text-sm text-muted truncate flex items-center gap-1.5">
            <Mail size={12} /> {client.email ?? user.email}
          </p>
          <p className="text-sm text-muted flex items-center gap-1.5">
            <Phone size={12} /> {client.phone}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-2xl border border-border p-4 text-center">
          <Calendar size={20} className="text-brand mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">{totalApts ?? 0}</p>
          <p className="text-xs text-muted">{t("profile.appointmentsDone")}</p>
        </div>
        <div className="bg-surface rounded-2xl border border-border p-4 text-center">
          <Scissors size={20} className="text-brand mx-auto mb-1" />
          <p className="text-2xl font-bold text-foreground">Amado</p>
          <p className="text-xs text-muted">{t("profile.yourBarber")}</p>
        </div>
      </div>

      {/* Menu */}
      <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
        <Row
          href="/perfil/editar"
          icon={<Pencil size={18} className="text-muted" />}
          label={t("profile.edit")}
        />
        <Row
          href="/perfil/editar"
          icon={<Globe size={18} className="text-muted" />}
          label={t("profile.language")}
          value={`${lang?.flag ?? ""} ${lang?.label ?? "Español"}`}
        />
        <Row
          href="/notificaciones"
          icon={<Bell size={18} className="text-muted" />}
          label={t("common.notifications")}
        />
        <Row
          href="/citas"
          icon={<Calendar size={18} className="text-muted" />}
          label={t("nav.myBookings")}
        />
        <Row
          href="/reservar"
          icon={<Scissors size={18} className="text-muted" />}
          label={t("nav.book")}
        />
        <Row
          href="/feedback"
          icon={<MessageSquare size={18} className="text-muted" />}
          label={t("feedback.title")}
        />
      </div>

      {/* Temporary while the accent is being decided — see lib/accents */}
      <AccentPicker />

      <SignOutButton />
    </div>
  );
}

function Row({
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
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-background">
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      {value && <span className="text-sm text-muted shrink-0">{value}</span>}
      <ChevronRight size={16} className="text-muted shrink-0" />
    </Link>
  );
}
