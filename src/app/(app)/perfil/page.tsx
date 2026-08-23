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
  User,
  Sun,
  HelpCircle,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { SignOutButton } from "@/components/profile/sign-out-button";
import { AccentPicker } from "@/components/theme/accent-picker";
import { SettingsGroup, SettingsRow } from "@/components/profile/settings-group";
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
        <BackButton />
        <h1 className="text-[17px] font-bold text-foreground">{t("profile.title")}</h1>
        <span className="w-10" aria-hidden />
      </header>

      {/*
        * The identity card. Avatar, who they are, how to reach them, and one
        * way in to change any of it — the mockup's "Edit Profile" row rather
        * than a pencil hidden in the corner.
        */}
      <div className="bg-surface rounded-[var(--radius-card)] border border-border p-4">
        <div className="flex items-center gap-3.5">
          <div className="w-[60px] h-[60px] rounded-full bg-surface-tint flex items-center justify-center shrink-0 relative overflow-hidden">
            {client.avatar_url ? (
              <Image src={client.avatar_url} alt="" fill sizes="60px" className="object-cover" />
            ) : (
              <span className="text-lg font-bold text-muted">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold text-foreground truncate">{displayName}</p>
            <p className="text-[12px] text-muted truncate flex items-center gap-1.5 mt-0.5">
              <Phone size={11} className="shrink-0" /> {client.phone}
            </p>
            <p className="text-[12px] text-muted truncate flex items-center gap-1.5">
              <Mail size={11} className="shrink-0" /> {client.email ?? user.email}
            </p>
          </div>
        </div>

        <Link
          href="/perfil/editar"
          className="mt-3 flex items-center gap-1 text-[13px] font-bold text-brand"
        >
          {t("profile.edit")} <ChevronRight size={14} />
        </Link>
      </div>

      {/* How many times they've been in — one number, not a dashboard */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-[var(--radius-card)] border border-border p-4 text-center">
          <Calendar size={18} className="text-brand mx-auto mb-1.5" />
          <p className="text-[22px] font-bold text-foreground leading-none">{totalApts ?? 0}</p>
          <p className="text-[11px] text-muted mt-1">{t("profile.appointmentsDone")}</p>
        </div>
        <div className="bg-surface rounded-[var(--radius-card)] border border-border p-4 text-center">
          <Scissors size={18} className="text-brand mx-auto mb-1.5" />
          <p className="text-[22px] font-bold text-foreground leading-none">Amado</p>
          <p className="text-[11px] text-muted mt-1">{t("profile.yourBarber")}</p>
        </div>
      </div>

      <SettingsGroup title={t("profile.myAccount")}>
        <SettingsRow
          href="/perfil/editar"
          icon={<User size={17} />}
          label={t("profile.personalInfo")}
        />
        <SettingsRow
          href="/citas"
          icon={<Calendar size={17} />}
          label={t("nav.myBookings")}
        />
        <SettingsRow
          href="/reservar"
          icon={<Scissors size={17} />}
          label={t("nav.book")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("profile.preferences")}>
        <SettingsRow
          href="/notificaciones"
          icon={<Bell size={17} />}
          label={t("common.notifications")}
        />
        <SettingsRow
          href="/perfil/editar"
          icon={<Globe size={17} />}
          label={t("profile.language")}
          value={lang?.label ?? "Español"}
        />
        <SettingsRow
          href="/perfil/editar"
          icon={<Sun size={17} />}
          label={t("profile.theme")}
          value={t("profile.themeLight")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("profile.support")}>
        <SettingsRow
          href="/feedback"
          icon={<MessageSquare size={17} />}
          label={t("feedback.title")}
        />
        <SettingsRow
          href="/feedback"
          icon={<HelpCircle size={17} />}
          label={t("profile.helpCenter")}
        />
      </SettingsGroup>

      {/* Temporary while the accent is being decided — see lib/accents */}
      <AccentPicker />

      <SignOutButton />
    </div>
  );
}
