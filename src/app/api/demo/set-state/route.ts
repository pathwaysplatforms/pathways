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
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isDev = process.env.NODE_ENV === "development";
    if (!user || (!isDev && user.email !== DEMO_EMAIL)) {
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
      await db.from("profiles").update({
        onboarding_status: "in_progress",
        onboarding_step: "not_started",
        selected_pathway_slug: null,
      }).eq("id", profile.id);
      await db.from("applications").delete().eq("profile_id", profile.id);
      await db.from("user_documents").delete().eq("user_id", profile.id);
    } else if (state === 2) {
      await db.from("profiles").update({
        onboarding_status: "complete",
        onboarding_step: "complete",
        selected_pathway_slug: null,
      }).eq("id", profile.id);
      await db.from("applications").delete().eq("profile_id", profile.id);
      await db.from("user_documents").delete().eq("user_id", profile.id);
    } else {
      // Prefer the canonical FSW Express Entry pathway (rich steps + seeded requirements).
      // Fall back to any pathway that has at least one document requirement.
      const { data: fsw } = await db
        .from("pathways")
        .select("id, slug")
        .eq("slug", "canada-express-entry-fsw")
        .eq("is_active", true)
        .maybeSingle();

      let pathway = fsw as { id: string; slug: string } | null;

      if (!pathway) {
        const { data: fallbackRows } = await db
          .from("document_requirements")
          .select("pathway_id")
          .limit(1);
        const fallbackPathwayId = (fallbackRows as { pathway_id: string }[] | null)?.[0]?.pathway_id ?? null;
        if (fallbackPathwayId) {
          const { data: pw } = await db
            .from("pathways")
            .select("id, slug")
            .eq("id", fallbackPathwayId)
            .eq("is_active", true)
            .maybeSingle();
          pathway = pw as { id: string; slug: string } | null;
        }
      }

      if (!pathway) {
        const { data: anyPw } = await db
          .from("pathways").select("id, slug").eq("is_active", true).limit(1).maybeSingle();
        pathway = anyPw as { id: string; slug: string } | null;
      }

      if (!pathway) {
        return NextResponse.json(
          { error: { code: "NO_PATHWAY", message: "No active pathway found — seed pathways first" } },
          { status: 400 }
        );
      }

      await db.from("profiles").update({
        onboarding_status: "complete",
        onboarding_step: "complete",
        selected_pathway_slug: pathway.slug,
      }).eq("id", profile.id);
      await db.from("applications").delete().eq("profile_id", profile.id);
      await db.from("applications").insert({
        profile_id: profile.id,
        pathway_id: pathway.id,
        status: state === 4 ? "submitted" : "draft",
        submitted_at: state === 4 ? new Date().toISOString() : null,
      });

      // Seed placeholder vault documents for the demo flow
      await db.from("user_documents").delete().eq("user_id", profile.id);
      const now = new Date();
      const demoDocs = [
        {
          user_id: profile.id,
          storage_path: `${profile.id}/demo-passport.pdf`,
          file_name: "passport_scan.pdf",
          display_name: "Passport",
          file_size: 2340000,
          mime_type: "application/pdf",
          document_type: "passport",
          uploaded_at: new Date(now.getTime() - 6 * 864e5).toISOString(),
        },
        {
          user_id: profile.id,
          storage_path: `${profile.id}/demo-ielts.pdf`,
          file_name: "ielts_results_2026.pdf",
          display_name: "IELTS Results",
          file_size: 524000,
          mime_type: "application/pdf",
          document_type: "language_test",
          uploaded_at: new Date(now.getTime() - 5 * 864e5).toISOString(),
        },
        {
          user_id: profile.id,
          storage_path: `${profile.id}/demo-bank-statement.pdf`,
          file_name: "bank_statement_may_2026.pdf",
          display_name: "Bank Statement",
          file_size: 318000,
          mime_type: "application/pdf",
          document_type: "bank_statement",
          uploaded_at: new Date(now.getTime() - 4 * 864e5).toISOString(),
        },
        {
          user_id: profile.id,
          storage_path: `${profile.id}/demo-transcript.pdf`,
          file_name: "university_transcript.pdf",
          display_name: "University Transcript",
          file_size: 891000,
          mime_type: "application/pdf",
          document_type: "academic_transcript",
          uploaded_at: new Date(now.getTime() - 3 * 864e5).toISOString(),
        },
        {
          user_id: profile.id,
          storage_path: `${profile.id}/demo-employment-letter.pdf`,
          file_name: "employment_letter_acme.pdf",
          display_name: "Employment Letter",
          file_size: 158000,
          mime_type: "application/pdf",
          document_type: "employment_letter",
          uploaded_at: new Date(now.getTime() - 2 * 864e5).toISOString(),
        },
      ];
      await db.from("user_documents").insert(demoDocs);
    }

    logger.info({ action: "demo.set_state", state });
    const host = request.headers.get("host") ?? "localhost:3001";
    return NextResponse.redirect(`http://${host}/dashboard`);
  } catch (error) {
    logger.error({ action: "demo.set_state_error", error: String(error) });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to set demo state" } },
      { status: 500 }
    );
  }
}
