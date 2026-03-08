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
  const pathname = req.nextUrl.pathname;
  const res = NextResponse.next();

  // ── Portal profile gate (runs before admin MFA gate) ──
  if (pathname.startsWith("/portal/")) {
    const hasToken = !!req.cookies.get("portal_token")?.value;
    const profileComplete = req.cookies.get("portal_profile_complete")?.value === "1";

    // Only gate authenticated patients (have a token cookie)
    if (hasToken) {
      const isOnboarding = pathname === "/portal/onboarding";
      const isProfileSetup = pathname === "/portal/profile-setup";

      if (!profileComplete && !isOnboarding && !isProfileSetup) {
        // Not completed profile → redirect to profile-setup
        const url = req.nextUrl.clone();
        url.pathname = "/portal/profile-setup";
        return NextResponse.redirect(url);
      }

      if (profileComplete && isProfileSetup) {
        // Already completed → redirect to welcome
        const url = req.nextUrl.clone();
        url.pathname = "/portal/welcome";
        return NextResponse.redirect(url);
      }
    }

    return res;
  }

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

  // Fallback: read role from cookie (set client-side by roleContext.ts).
  // This covers demo mode and non-Supabase-authenticated users where the
  // role is selected via the persona picker and stored in sessionStorage + cookie.
  if (!role) {
    const cookieRole = req.cookies.get("empathAI_role")?.value ?? null;
    if (cookieRole && ["therapist", "manager", "patient", "admin"].includes(cookieRole)) {
      role = cookieRole;
    }
  }

  const result = checkMfaGate({
    role,
    aal,
    path: pathname,
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
  matcher: ["/admin/:path*", "/portal/:path*"],
};
