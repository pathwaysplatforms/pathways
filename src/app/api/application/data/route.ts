import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { getApplicationData } from '@/modules/application/service';
import type { ProfileContext, DashboardDocument } from '@/modules/dashboard/types';
import { profileRowToCrsInput } from '@/lib/crs-input';
import { computeCrsEstimate } from '@/lib/crs-estimate';

/** GET /api/application/data — application data for the NavigationPlane ApplicationView.
 *  Optional ?slug= param overrides the user's selected_pathway_slug for view-switching.
 *  Optional ?applicationId= loads a specific application — the caller's own or a
 *  co-applicant's they manage — instead of the caller's own selected pathway. */
export async function GET(req: NextRequest): Promise<Response> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'api.application.data.start' });

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return Response.json(
        { error: { code: 'AUTH_ERROR', message: 'Not authenticated.' } },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const slugOverride = url.searchParams.get('slug') ?? null;
    const applicationId = url.searchParams.get('applicationId') ?? null;

    const db = supabase as unknown as SupabaseClient;

    // When loading a specific application, profile context (occupation, CRS
    // inputs, etc.) must reflect whoever that application belongs to — the
    // caller's own profile, or a co-applicant's — not always the caller.
    let contextProfileId: string | null = null;
    if (applicationId) {
      const { data: appRow } = await db
        .from('applications')
        .select('profile_id')
        .eq('id', applicationId)
        .maybeSingle();
      contextProfileId = (appRow as { profile_id: string } | null)?.profile_id ?? null;
    }

    const profileFields =
      'full_name, occupation, degree_level, degree_field, nationality, ' +
      'date_of_birth, education_level, eca_obtained, clb_speaking, clb_listening, ' +
      'clb_reading, clb_writing, language_proficiency_self, canadian_work_years, ' +
      'foreign_work_years, foreign_work_recent, years_experience, noc_teer_category, ' +
      'noc_code, has_provincial_nomination, has_canadian_job_offer, has_sibling_in_canada, ' +
      'spouse_coming_to_canada, spouse_clb_speaking, spouse_clb_listening, ' +
      'spouse_clb_reading, spouse_clb_writing, spouse_canadian_work_years';

    // RLS scopes both branches to profiles the caller may act as — a
    // co-applicant id belonging to someone else simply resolves to null.
    const { data: profileRow } = contextProfileId
      ? await db.from('profiles').select(profileFields).eq('id', contextProfileId).maybeSingle()
      : await db.from('profiles').select(profileFields).eq('auth_user_id', user.id).maybeSingle();

    type ProfileFields = {
      full_name: string | null;
      occupation: string | null;
      degree_level: string | null;
      degree_field: string | null;
      nationality: string | null;
      date_of_birth: string | null;
      education_level: string | null;
      eca_obtained: boolean | null;
      clb_speaking: number | null;
      clb_listening: number | null;
      clb_reading: number | null;
      clb_writing: number | null;
      language_proficiency_self: string | null;
      canadian_work_years: number | null;
      foreign_work_years: number | null;
      foreign_work_recent: boolean | null;
      years_experience: number | null;
      noc_teer_category: number | null;
      noc_code: string | null;
      has_provincial_nomination: boolean | null;
      has_canadian_job_offer: boolean | null;
      has_sibling_in_canada: boolean | null;
      spouse_coming_to_canada: boolean | null;
      spouse_clb_speaking: number | null;
      spouse_clb_listening: number | null;
      spouse_clb_reading: number | null;
      spouse_clb_writing: number | null;
      spouse_canadian_work_years: number | null;
    };
    const pf = profileRow as ProfileFields | null;
    const profileContext: ProfileContext = {
      fullName: pf?.full_name ?? null,
      occupation: pf?.occupation ?? null,
      degreeLevel: pf?.degree_level ?? null,
      degreeField: pf?.degree_field ?? null,
      nationality: pf?.nationality ?? null,
      nocCode: pf?.noc_code ?? null,
      pathwayInputJson: null,
    };

    let crsScore: number | null = null;
    if (pf) {
      const estimate = computeCrsEstimate(profileRowToCrsInput(pf));
      if (estimate !== null && estimate.score > 0) crsScore = estimate.score;
    }

    const appData = await getApplicationData(user.id, log, slugOverride, applicationId);

    if (!appData) {
      log.info({ action: 'api.application.data.noApp' });
      return Response.json({ data: null, profileContext });
    }

    const documents: DashboardDocument[] = appData.documents.map(d => ({
      id: d.id,
      name: d.name,
      isMandatory: d.isMandatory,
      status: d.satisfied ? 'uploaded' : 'pending',
      documentType: d.documentType,
    }));

    log.info({ action: 'api.application.data.complete' });
    return Response.json({
      data: {
        pathway: {
          title: appData.pathwayTitle,
          officialName: appData.pathwayOfficialName ?? '',
          slug: appData.pathwaySlug,
          processingTime: appData.processingTime,
          totalSteps: appData.totalSteps,
          description: appData.pathwayDescription ?? '',
        },
        steps: appData.steps,
        profileContext,
        documents,
        crsScore,
      },
    });
  } catch (err) {
    log.error({ action: 'api.application.data.error', err });
    return Response.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load application data.' } },
      { status: 500 },
    );
  }
}
