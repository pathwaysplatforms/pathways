import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRequestLogger } from "@/lib/logger";

const DEMO_EMAIL = "admin@demo.com";

/** Instant demo login — creates the demo user if needed, bypasses email via admin generateLink. */
export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO_ENABLED !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const logger = createRequestLogger(crypto.randomUUID());
  const origin = new URL(request.url).origin;

  try {
    const admin = createSupabaseAdminClient();
    // Database types pending regeneration — cast until `supabase gen types --local` is run
    const db = admin as unknown as SupabaseClient;

    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL,
      options: { redirectTo: `${origin}/auth/demo/callback` },
    });

    if (linkError || !data?.properties?.action_link) {
      throw linkError ?? new Error("generateLink returned no action_link");
    }

    // Upsert demo profile — trigger may have already created the row; this seeds realistic data
    await db.from("profiles").upsert(
      {
        auth_user_id: data.user.id,
        full_name: "Alex Chen",
        email: DEMO_EMAIL,
        nationality: "Indian",
        current_country: "Canada",
        occupation: "Software Engineer",
        years_experience: 5,
        has_degree: true,
        english_level: "advanced",
        marital_status: "single",
        has_dependents: false,
        onboarding_status: "complete",
        profile_completeness_pct: 78,
      },
      { onConflict: "auth_user_id" }
    );

    logger.info({
      action: "demo.login",
      userId: data.user.id,
      actionLink: data.properties.action_link,
      redirectTo: data.properties.redirect_to,
    });
    return NextResponse.redirect(data.properties.action_link);
  } catch (error) {
    logger.error({ action: "demo.login_error", error: String(error) });
    return NextResponse.redirect(new URL("/auth/login?error=auth", request.url));
  }
}
