import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Profile } from "@/modules/auth/types";

/*
 * ─────────────────────────────────────────────────────────────────
 * ONBOARDING ROUTING DECISION TREE
 * ─────────────────────────────────────────────────────────────────
 * Applies to every authenticated request on /onboarding/* and /dashboard/*.
 *
 *   onboarding_step = 'not_started'       → redirect to /onboarding/voice
 *   onboarding_step = 'voice_in_progress' → redirect to /onboarding/voice   (resume)
 *   onboarding_step = 'voice_complete'    → redirect to /onboarding/review
 *   onboarding_step = 'complete'          → allow through (no forced redirect)
 *   onboarding_step = null  (legacy row)  → treated as 'not_started'
 *
 *   Special: /onboarding/matches is only reachable when onboarding_step = 'complete'.
 *   A direct visit with any other step redirects to the step's correct route above.
 *
 *   A user already on the correct route for their step is never redirected.
 * ─────────────────────────────────────────────────────────────────
 */

/** Returns the canonical route for the given onboarding step, or null when complete. */
function requiredRouteForStep(step: Profile["onboarding_step"]): string | null {
  switch (step) {
    case "voice_complete":
      return "/onboarding/review";
    case "complete":
      return null;
    default:
      // not_started, voice_in_progress, null, unknown → go to voice onboarding
      return "/onboarding/voice";
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });
  // Expose current pathname to server components via header
  response.headers.set("x-pathname", pathname);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          response.headers.set("x-pathname", pathname);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Public routes accessible without authentication
  const isPublicPath =
    pathname === "/" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/results");

  if (!session) {
    if (isPublicPath) return response;
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Use the service role key so RLS does not block the profile read.
  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await adminDb
    .from("profiles")
    .select("onboarding_step, is_admin")
    .eq("auth_user_id", session.user.id)
    .single();

  const profile = data as Pick<Profile, "onboarding_step" | "is_admin"> | null;
  const onboardingStep = profile?.onboarding_step ?? null;
  const isAdmin = profile?.is_admin ?? false;

  const isApiPath = pathname.startsWith("/api/");
  const isOnboardingPath = pathname.startsWith("/onboarding");
  const isOnboardingMatchesPath = pathname.startsWith("/onboarding/matches");
  const isDashboardPath = pathname.startsWith("/dashboard");
  const isAdminPath = pathname.startsWith("/admin");

  if (!isApiPath && (isOnboardingPath || isDashboardPath)) {
    // Authenticated users with complete onboarding visiting /onboarding/* go to dashboard
    if (isOnboardingPath && !isOnboardingMatchesPath && onboardingStep === "complete") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // /onboarding/matches is only accessible when onboarding is complete
    if (isOnboardingMatchesPath && onboardingStep !== "complete") {
      const fallback = requiredRouteForStep(onboardingStep) ?? "/onboarding/voice";
      return NextResponse.redirect(new URL(fallback, request.url));
    }

    const target = requiredRouteForStep(onboardingStep);

    // /onboarding (root only) is always reachable — the page handles its own routing
    // so that the public CTA lands on the choice screen regardless of auth state.
    const isOnboardingRoot = pathname === "/onboarding";

    // If the user's step requires a specific route and they are not on it, redirect
    if (target !== null && !pathname.startsWith(target) && !isOnboardingRoot) {
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  if (!isApiPath && isAdminPath && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!auth/|api/auth/|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
