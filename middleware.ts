import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/modules/auth/types";

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

  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // Database types pending regeneration — cast until `supabase gen types --local` is run
  const db = supabase as unknown as SupabaseClient;
  const { data } = await db
    .from("profiles")
    .select("onboarding_status, is_admin")
    .eq("auth_user_id", session.user.id)
    .single();

  const profile = data as Pick<Profile, "onboarding_status" | "is_admin"> | null;
  const onboardingStatus = profile?.onboarding_status ?? "not_started";
  const isAdmin = profile?.is_admin ?? false;

  const isApiPath = pathname.startsWith("/api/");
  const isOnboardingPath = pathname.startsWith("/onboarding");
  const isAdminPath = pathname.startsWith("/admin");

  if (!isApiPath && onboardingStatus === "not_started" && !isOnboardingPath) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  if (!isApiPath && onboardingStatus === "voice_complete" && !isOnboardingPath) {
    return NextResponse.redirect(new URL("/onboarding/review", request.url));
  }

  if (isAdminPath && !isAdmin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!auth/|api/auth/|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
