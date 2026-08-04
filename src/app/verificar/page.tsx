import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionClient, INACTIVITY_DAYS } from "@/lib/session";
import { VerifySessionForm } from "@/components/auth/verify-session-form";

export default async function VerificarPage() {
  const session = await getSessionClient();

  if (session.state === "anonymous") redirect("/login");
  if (session.state === "no-profile") redirect("/configurar-perfil");
  if (session.state === "ok") redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <VerifySessionForm
      email={user?.email ?? ""}
      firstName={session.client.first_name ?? session.client.full_name.split(" ")[0]}
      inactivityDays={INACTIVITY_DAYS}
    />
  );
}
