import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRequestLogger } from "@/lib/logger";
import { migrateGuestSession } from "@/modules/guest/service";
import type { Profile } from "@/modules/auth/types";

/** Map a Supabase Auth error to a query param for the login page. */
function mapAuthError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("expired") || lower.includes("otp expired")) return "expired";
  if (lower.includes("invalid") || lower.includes("not found")) return "invalid";
  return "generic";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const guestToken = requestUrl.searchParams.get("guest_token");
  const reqLogger = createRequestLogger(crypto.randomUUID());

  if (!code) {
    reqLogger.warn({ action: "auth.callback_no_code" });
    return NextResponse.redirect(new URL("/auth/login?error=invalid", request.url));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      reqLogger.error({
        action: "auth.callback_exchange_failed",
        error: exchangeError.message,
      });
      const errorCode = mapAuthError(exchangeError.message);
      return NextResponse.redirect(new URL(`/auth/login?error=${errorCode}`, request.url));
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/auth/login?error=generic", request.url));
    }

    // Migrate guest session data into the new profile if a token was passed
    if (guestToken) {
      try {
        await migrateGuestSession(guestToken, user.id, reqLogger);
        reqLogger.info({ action: "auth.callback_guest_migrated", userId: user.id });
      } catch (migrationErr) {
        reqLogger.warn({ action: "auth.callback_guest_migration_skipped", error: String(migrationErr) });
      }
    }

    const db = supabase as unknown as SupabaseClient;
    const { data } = await db
      .from("profiles")
      .select("onboarding_step")
      .eq("auth_user_id", user.id)
      .single();

    const profile = data as Pick<Profile, "onboarding_step"> | null;
    const step = profile?.onboarding_step ?? null;

    const redirectPath = guestToken
      ? "/dashboard?welcome=1"
      : step === "complete"
        ? "/dashboard"
        : step === "voice_complete"
          ? "/onboarding/review"
          : "/onboarding/voice";

    reqLogger.info({
      action: "auth.callback_success",
      userId: user.id,
      redirectPath,
    });

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    reqLogger.error({ action: "auth.callback_error", error: String(error) });
    return NextResponse.redirect(new URL("/auth/login?error=generic", request.url));
  }
}
