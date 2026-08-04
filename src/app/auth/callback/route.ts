import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // OAuth provider errors arrive as query params, not exceptions
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");

  // Behind Vercel's proxy `origin` is the internal URL, which breaks the
  // redirect. Rebuild it from the forwarded headers when present.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const baseUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;

  if (oauthError) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(error?.message ?? "auth_failed")}`
    );
  }

  // Google users have no client record yet — create it from their profile
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!existing) {
    const meta = data.user.user_metadata ?? {};
    const fullName = String(meta.full_name ?? meta.name ?? data.user.email ?? "Cliente");
    const [firstName, ...rest] = fullName.trim().split(" ");

    const { error: insertError } = await supabase.from("clients").insert({
      full_name: fullName,
      first_name: firstName,
      last_name: rest.join(" ") || null,
      email: data.user.email ?? null,
      phone: String(meta.phone ?? ""),
      avatar_url: meta.avatar_url ?? meta.picture ?? null,
      user_id: data.user.id,
      segment: "nuevo",
    });

    // Missing phone is the expected case for Google — finish setup in-app
    if (insertError) {
      return NextResponse.redirect(`${baseUrl}/configurar-perfil`);
    }
  }

  return NextResponse.redirect(`${baseUrl}${next}`);
}
