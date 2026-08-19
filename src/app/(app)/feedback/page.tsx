import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { shopShortDate } from "@/lib/timezone";
import { getT } from "@/lib/session";

export default async function FeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!client) redirect("/configurar-perfil");

  const { t } = await getT();

  // Their own history, so it's clear the message actually went somewhere
  const { data: mine } = await supabase
    .from("feedback")
    .select("id, area, message, created_at, status")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="px-4 pt-[max(12px,var(--safe-top))] pb-6 space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground">{t("feedback.title")}</h1>
          <p className="text-xs text-muted">{t("feedback.subtitle")}</p>
        </div>
      </header>

      <FeedbackForm clientId={client.id} />

      {mine && mine.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold text-muted uppercase tracking-wide">
            {t("feedback.yours")}
          </h2>
          <ul className="space-y-2">
            {mine.map((f) => (
              <li key={f.id} className="bg-surface rounded-2xl border border-border p-3.5">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare size={13} className="text-muted shrink-0" />
                  <span className="text-[11px] font-bold text-muted uppercase">
                    {f.area === "app" ? t("feedback.areaApp") : t("feedback.areaService")}
                  </span>
                  <span className="text-[11px] text-muted/60 ml-auto">
                    {shopShortDate(f.created_at)}
                  </span>
                </div>
                <p className="text-sm text-foreground">{f.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
