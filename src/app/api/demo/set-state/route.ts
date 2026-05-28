import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRequestLogger } from "@/lib/logger";

const DEMO_EMAIL = "admin@demo.com";

/**
 * Switches the demo user's dashboard state.
 * Query param: ?state=1|2|3|4
 * Only available when NEXT_PUBLIC_DEMO_ENABLED=true and the caller is admin@demo.com.
 */
export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO_ENABLED !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const logger = createRequestLogger(crypto.randomUUID());
  const state = parseInt(new URL(request.url).searchParams.get("state") ?? "1", 10);

  if (isNaN(state) || state < 1 || state > 4) {
    return NextResponse.json(
      { error: { code: "INVALID_STATE", message: "state must be 1–4" } },
      { status: 400 }
    );
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.email !== DEMO_EMAIL) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only available for the demo user" } },
        { status: 403 }
      );
    }

    const admin = createSupabaseAdminClient();
    // Database types pending regeneration — cast until `supabase gen types --local` is run
    const db = admin as unknown as SupabaseClient;

    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Demo profile not found" } },
        { status: 404 }
      );
    }

    if (state === 1) {
      await db.from("profiles").update({ onboarding_status: "in_progress" }).eq("id", profile.id);
      await db.from("applications").delete().eq("profile_id", profile.id);
    } else if (state === 2) {
      await db.from("profiles").update({ onboarding_status: "complete" }).eq("id", profile.id);
      await db.from("applications").delete().eq("profile_id", profile.id);
    } else {
      const { data: pathway } = await db
        .from("pathways")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!pathway) {
        return NextResponse.json(
          { error: { code: "NO_PATHWAY", message: "No active pathway found — seed pathways first" } },
          { status: 400 }
        );
      }

      await db.from("profiles").update({ onboarding_status: "complete" }).eq("id", profile.id);
      await db.from("applications").delete().eq("profile_id", profile.id);
      await db.from("applications").insert({
        profile_id: profile.id,
        pathway_id: pathway.id,
        status: state === 4 ? "submitted" : "draft",
        submitted_at: state === 4 ? new Date().toISOString() : null,
      });
    }

    logger.info({ action: "demo.set_state", state });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    logger.error({ action: "demo.set_state_error", error: String(error) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to set demo state" } },
      { status: 500 }
    );
  }
}
