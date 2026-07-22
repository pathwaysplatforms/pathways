import { type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createRequestLogger } from "@/lib/logger";

const DEMO_EMAIL = "admin@demo.com";

/**
 * Instant demo login — upserts the demo profile with a full state-3 seed
 * (selected pathway + draft application + demo documents) then redirects
 * via magic link so the user lands on /dashboard with everything wired up.
 */
export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_DEMO_ENABLED !== "true") {
    return new NextResponse(null, { status: 404 });
  }

  const logger = createRequestLogger(crypto.randomUUID());
  const host = request.headers.get("host") ?? "localhost:3001";
  const origin = `http://${host}`;

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

    // Fetch profile id so we can seed application state
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("auth_user_id", data.user.id)
      .single() as { data: { id: string } | null };

    if (profile) {
      await seedDemoApplication(db, profile.id, logger);
    }

    logger.info({ action: "demo.login", userId: data.user.id });
    return NextResponse.redirect(data.properties.action_link);
  } catch (error) {
    logger.error({ action: "demo.login_error", error: String(error) });
    return NextResponse.redirect(`http://${host}/auth/login?error=auth`);
  }
}

/** Seeds a draft application + selected pathway + demo documents for the demo profile. */
async function seedDemoApplication(
  db: SupabaseClient,
  profileId: string,
  logger: ReturnType<typeof createRequestLogger>
) {
  // Prefer the canonical FSW pathway; fall back to any active pathway
  const { data: fsw } = await db
    .from("pathways")
    .select("id, slug")
    .eq("slug", "canada-express-entry-fsw")
    .eq("is_active", true)
    .maybeSingle() as { data: { id: string; slug: string } | null };

  let pathway = fsw;

  if (!pathway) {
    const { data: anyPw } = await db
      .from("pathways")
      .select("id, slug")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle() as { data: { id: string; slug: string } | null };
    pathway = anyPw;
  }

  if (!pathway) {
    logger.warn({ action: "demo.seed_skip", reason: "no active pathway found" });
    return;
  }

  await db.from("profiles").update({
    onboarding_status: "complete",
    onboarding_step: "complete",
    selected_pathway_slug: pathway.slug,
  }).eq("id", profileId);

  await db.from("applications").delete().eq("profile_id", profileId);
  await db.from("applications").insert({
    profile_id: profileId,
    pathway_id: pathway.id,
    status: "draft",
    submitted_at: null,
  });

  const now = new Date();
  await db.from("user_documents").delete().eq("user_id", profileId);
  await db.from("user_documents").insert([
    {
      user_id: profileId,
      storage_path: `${profileId}/demo-passport.pdf`,
      file_name: "passport_scan.pdf",
      display_name: "Passport",
      file_size: 2340000,
      mime_type: "application/pdf",
      document_type: "passport",
      uploaded_at: new Date(now.getTime() - 6 * 864e5).toISOString(),
    },
    {
      user_id: profileId,
      storage_path: `${profileId}/demo-ielts.pdf`,
      file_name: "ielts_results_2026.pdf",
      display_name: "IELTS Results",
      file_size: 524000,
      mime_type: "application/pdf",
      document_type: "language_test",
      uploaded_at: new Date(now.getTime() - 5 * 864e5).toISOString(),
    },
    {
      user_id: profileId,
      storage_path: `${profileId}/demo-bank-statement.pdf`,
      file_name: "bank_statement_may_2026.pdf",
      display_name: "Bank Statement",
      file_size: 318000,
      mime_type: "application/pdf",
      document_type: "bank_statement",
      uploaded_at: new Date(now.getTime() - 4 * 864e5).toISOString(),
    },
    {
      user_id: profileId,
      storage_path: `${profileId}/demo-transcript.pdf`,
      file_name: "university_transcript.pdf",
      display_name: "University Transcript",
      file_size: 891000,
      mime_type: "application/pdf",
      document_type: "academic_transcript",
      uploaded_at: new Date(now.getTime() - 3 * 864e5).toISOString(),
    },
    {
      user_id: profileId,
      storage_path: `${profileId}/demo-employment-letter.pdf`,
      file_name: "employment_letter_acme.pdf",
      display_name: "Employment Letter",
      file_size: 158000,
      mime_type: "application/pdf",
      document_type: "employment_letter",
      uploaded_at: new Date(now.getTime() - 2 * 864e5).toISOString(),
    },
  ]);

  logger.info({ action: "demo.seed_complete", pathwaySlug: pathway.slug, profileId });
}
