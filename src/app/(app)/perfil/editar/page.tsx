import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { ProfileEditor } from "@/components/profile/profile-editor";
import type { Language } from "@/lib/i18n";

export default async function EditarPerfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, first_name, last_name, phone, email, avatar_url, language")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client) redirect("/configurar-perfil");

  const [fallbackFirst, ...fallbackRest] = (client.full_name ?? "").split(" ");

  return (
    <div className="px-4 pt-[max(20px,var(--safe-top))] pb-4 space-y-5">
      <header className="flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-foreground">Editar perfil</h1>
          <p className="text-sm text-muted">Actualiza tu información personal</p>
        </div>
      </header>

      <ProfileEditor
        profile={{
          id: client.id,
          firstName: client.first_name ?? fallbackFirst ?? "",
          lastName: client.last_name ?? fallbackRest.join(" ") ?? "",
          phone: client.phone ?? "",
          email: client.email ?? user.email ?? "",
          avatarUrl: client.avatar_url,
          language: (client.language ?? "es") as Language,
        }}
      />
    </div>
  );
}
