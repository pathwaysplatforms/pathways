import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRequestLogger } from "@/lib/logger";
import type { Profile } from "@/modules/auth/types";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const reqLogger = createRequestLogger(crypto.randomUUID());

  if (!code) {
    reqLogger.warn({ action: "auth.callback_no_code" });
    return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      reqLogger.error({
        action: "auth.callback_exchange_failed",
        error: exchangeError.message,
      });
      return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
    }

    // Database types pending regeneration — cast until `supabase gen types --local` is run
    const db = supabase as unknown as SupabaseClient;
    const { data } = await db
      .from("profiles")
      .select("onboarding_status")
      .eq("auth_user_id", user.id)
      .single();

    const profile = data as Pick<Profile, "onboarding_status"> | null;
    const status = profile?.onboarding_status ?? "not_started";

    const redirectPath =
      status === "complete"
        ? "/dashboard"
        : status === "voice_complete"
          ? "/onboarding/review"
          : "/onboarding";

    reqLogger.info({
      action: "auth.callback_success",
      userId: user.id,
      redirectPath,
    });

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    reqLogger.error({ action: "auth.callback_error", error: String(error) });
    return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
  }
}
