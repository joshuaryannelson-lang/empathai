// middleware.ts
// Next.js Edge Middleware — enforces MFA for manager accounts on /admin routes.
// Uses @supabase/ssr to read the Supabase session from cookies.
//
// NOTE: Next.js 16 emits a build warning suggesting 'proxy' instead of 'middleware'.
// The 'proxy' file convention is experimental (Turbopack only) and not yet stable.
// Keep using middleware.ts until the proxy API is GA. Revisit on next Next.js upgrade.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkMfaGate } from "@/lib/mfaGuard";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Create a Supabase client that reads/writes cookies on the request/response
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Get the current session and AAL level
  const { data: { session } } = await supabase.auth.getSession();

  let role: string | null = null;
  let aal: "aal1" | "aal2" | null = null;

  if (session) {
    role = session.user?.app_metadata?.role
      ?? session.user?.user_metadata?.role
      ?? null;

    // Get the AAL from the MFA authenticator assurance level
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    aal = mfaData?.currentLevel ?? null;
  }

  const result = checkMfaGate({
    role,
    aal,
    path: req.nextUrl.pathname,
  });

  if (result.action === "redirect") {
    const url = req.nextUrl.clone();
    url.pathname = result.destination.split("?")[0];
    url.search = result.destination.includes("?")
      ? "?" + result.destination.split("?")[1]
      : "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
