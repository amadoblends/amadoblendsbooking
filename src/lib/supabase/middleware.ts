import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Reachable without a session. /verificar and /configurar-perfil are NOT here
// on purpose: they need a logged-in user and guard themselves.
const PUBLIC_PATHS = ["/login", "/auth/callback", "/manifest.json", "/sw.js"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  /*
   * getClaims() verifies the JWT locally against the project's cached JWKS,
   * where getUser() calls /auth/v1/user over the network. Middleware runs on
   * *every* request, so that round trip was being paid constantly just to
   * answer "is this person signed in?".
   */
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims ? { id: claims.claims.sub } : null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
