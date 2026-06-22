import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { Tables } from '@/types/database';
import type {
  DashboardData,
  DashboardState,
  ApplicationStep,
  EnrichedApplicationStep,
  LatestDraw,
  StepResource,
  DashboardDocument,
  OnboardingStep,
  Recommendation,
  RecommendedPathway,
  ProfileContext,
} from './types';
import { ONBOARDING_STEPS_META, STEP_FIELDS } from './types';

/** Pathway fields selected in joined application query. */
interface PathwaySnapshot {
  id: string;
  slug: string;
  title: string;
  official_name: string;
  processing_time_min: string;
  processing_time_max: string;
}

/**
 * Maps a pathway slug to the immigration_draws.draw_type values that are
 * meaningful for that stream. Returns an array for use with .in().
 * "No Program Specified" covers all-pool Express Entry draws.
 */
function getDrawTypesForPathway(slug: string | null): string[] {
  if (!slug) return ['No Program Specified', 'FSW'];
  const s = slug.toLowerCase();
  if (s.includes('federal-skilled-worker') || s.includes('fsw')) return ['FSW', 'No Program Specified'];
  if (s.includes('canadian-experience') || s.includes('cec')) return ['CEC', 'No Program Specified'];
  if (s.includes('federal-skilled-trades') || s.includes('fst')) return ['FST'];
  if (s.includes('pnp') || s.includes('provincial')) return ['PNP'];
  // express-entry (generic slug) covers the FSW pool + all-program draws
  return ['No Program Specified', 'FSW'];
}

/** Application row joined with its pathway snapshot. */
type ApplicationWithPathway = Tables<'applications'> & {
  pathway: PathwaySnapshot | null;
};

/** Document row joined with its requirement. */
interface DocumentWithRequirement {
  id: string;
  status: string;
  requirement: { name: string; is_mandatory: boolean } | null;
}

/** Derives the dashboard state from profile and application data. */
function deriveDashboardState(
  profile: Tables<'profiles'>,
  application: ApplicationWithPathway | null
): DashboardState {
  if (profile.onboarding_status !== 'complete') return 'onboarding_incomplete';
  if (!application) {
    const slug = (profile as Record<string, unknown>).selected_pathway_slug;
    return typeof slug === 'string' && slug.length > 0
      ? 'pathway_selected'
      : 'pathway_not_selected';
  }
  if (!application.submitted_at) return 'application_in_progress';
  return 'application_submitted';
}

/** Extracts the first name from a full name string. */
function firstName(fullName: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] ?? 'there';
}

/** Builds initials (up to 2 chars) from a full name. */
function avatarInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/** Formats processing time range into a human-readable string. */
function formatProcessingTime(min: string, max: string): string {
  return `${min}–${max}`;
}

/** Derives onboarding step completeness from the profile's incomplete_fields list. */
function deriveOnboardingSteps(profile: Tables<'profiles'>): OnboardingStep[] {
  const incomplete = new Set(profile.incomplete_fields ?? []);
  return ONBOARDING_STEPS_META.map((step) => {
    const fields = STEP_FIELDS[step.id] ?? [];
    const completed = fields.every((field) => !incomplete.has(field as string));
    return { ...step, completed };
  });
}

/** Derives application steps with statuses from pathway_steps and document completion ratio. */
function deriveApplicationSteps(
  pathwaySteps: Tables<'pathway_steps'>[],
  documents: DocumentWithRequirement[],
  allSubmitted: boolean
): ApplicationStep[] {
  if (pathwaySteps.length === 0) return [];

  const mandatoryDocs = documents.filter((d) => d.requirement?.is_mandatory === true);
  const doneDocs = mandatoryDocs.filter(
    (d) => d.status === 'uploaded' || d.status === 'verified'
  );

  let completedStepCount: number;

  if (allSubmitted) {
    completedStepCount = pathwaySteps.length;
  } else if (mandatoryDocs.length === 0) {
    completedStepCount = 0;
  } else {
    const ratio = doneDocs.length / mandatoryDocs.length;
    completedStepCount = Math.floor(ratio * pathwaySteps.length);
  }

  return pathwaySteps.map((step, index): ApplicationStep => {
    let status: 'complete' | 'current' | 'upcoming';
    if (index < completedStepCount) {
      status = 'complete';
    } else if (index === completedStepCount) {
      status = 'current';
    } else {
      status = 'upcoming';
    }

    return {
      id: step.id,
      stepNumber: step.step_number,
      label: step.title,
      description: step.description,
      estimatedDuration: step.estimated_duration,
      status,
    };
  });
}

/** Derives up to 3 recommendations from profile gap analysis. */
function deriveRecommendations(profile: Tables<'profiles'>): Recommendation[] {
  const recs: Recommendation[] = [];

  if (!profile.eca_obtained) {
    recs.push({
      id: 'eca',
      label: 'Get your ECA',
      description: 'Foreign credentials recognised in Canada.',
      impactLabel: '+15 pts',
    });
  }

  if (!profile.has_canadian_job_offer) {
    recs.push({
      id: 'job-offer',
      label: 'Secure a Canadian job offer',
      description: 'Significantly increases your score.',
      impactLabel: '+50 pts',
    });
  }

  if (!profile.canadian_work_years || profile.canadian_work_years === 0) {
    recs.push({
      id: 'canadian-work',
      label: 'Canadian work experience',
      description: 'Even 1 year improves your ranking.',
      impactLabel: '+10 pts',
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: 'complete-profile',
      label: 'Complete your profile',
      description: 'A complete profile improves your match accuracy.',
      impactLabel: '',
    });
  }

  return recs.slice(0, 3);
}

/**
 * Fetches all data required to render the dashboard for a given authenticated user.
 * Throws NotFoundError if the profile does not exist, DatabaseError on query failure.
 */
export async function getDashboardData(
  userId: string,
  logger: Logger
): Promise<DashboardData> {
  logger.info({ action: 'getDashboardData.start', userId });

  // The typed Supabase client (@supabase/ssr) produces `never` for query data fields
  // due to a type incompatibility with the generated Database types in this project.
  // Pattern mirrors auth/service.ts — cast to untyped client, assert result types manually.
  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

  // Step 1: fetch profile
  const { data: profileData, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('auth_user_id', userId)
    .single();

  if (profileError) {
    if ((profileError as { code?: string }).code === 'PGRST116') {
      throw new NotFoundError('Profile not found', { userId });
    }
    throw new DatabaseError('Failed to fetch profile', { userId }, profileError);
  }

  if (!profileData) {
    throw new DatabaseError('Profile returned null unexpectedly', { userId });
  }

  const profile = profileData as Tables<'profiles'>;

  // Extract CRS from pathway_input_json — two write-path shapes exist:
  // Shape A (PathwayInput/confirm route): crs_estimate is an object { range_low, range_high, confidence, ... }
  // Shape B (legacy triggerPathwayRecognition): crs_estimate is a scalar number; range in crs_estimate_low/high
  const pathwayInput = profile.pathway_input_json as Record<string, unknown> | null;
  const rawCrs = pathwayInput?.crs_estimate;

  let crsScore: number | null = null;
  let crsRangeLow: number | null = null;
  let crsRangeHigh: number | null = null;
  let crsConfidence: string | null = null;

  if (rawCrs !== null && rawCrs !== undefined) {
    if (typeof rawCrs === 'object') {
      const crsObj = rawCrs as Record<string, unknown>;
      // Shape C (recalculateCrsEstimate / CrsEstimate object): { score, low, high, margin, ... }
      if (typeof crsObj.score === 'number' && Number.isFinite(crsObj.score)) {
        crsScore = crsObj.score;
        crsRangeLow = typeof crsObj.low === 'number' ? crsObj.low : null;
        crsRangeHigh = typeof crsObj.high === 'number' ? crsObj.high : null;
      // Shape A (buildPathwayInput / confirm route): { range_low, range_high, confidence }
      } else if (typeof crsObj.range_low === 'number' && typeof crsObj.range_high === 'number') {
        crsRangeLow = crsObj.range_low;
        crsRangeHigh = crsObj.range_high;
        crsScore = Math.round((crsRangeLow + crsRangeHigh) / 2);
        crsConfidence = typeof crsObj.confidence === 'string' ? crsObj.confidence : null;
      }
    } else if (typeof rawCrs === 'number' && Number.isFinite(rawCrs)) {
      // Shape B (legacy triggerPathwayRecognition, now removed): scalar midpoint
      crsScore = rawCrs;
      const rawLow = pathwayInput?.crs_estimate_low;
      const rawHigh = pathwayInput?.crs_estimate_high;
      crsRangeLow = typeof rawLow === 'number' ? rawLow : null;
      crsRangeHigh = typeof rawHigh === 'number' ? rawHigh : null;
    }
  }

  // Step 2: fetch application joined with pathway
  const { data: applicationData, error: applicationError } = await db
    .from('applications')
    .select(`
      *,
      pathway:pathways (
        id,
        slug,
        title,
        official_name,
        processing_time_min,
        processing_time_max
      )
    `)
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (applicationError) {
    throw new DatabaseError('Failed to fetch application', { userId, profileId: profile.id }, applicationError);
  }

  const appWithPathway = (applicationData ?? null) as ApplicationWithPathway | null;
  const state = deriveDashboardState(profile, appWithPathway);

  // Step 3: fetch secondary data in parallel based on state
  let pathwaySteps: Tables<'pathway_steps'>[] = [];
  let rawDocuments: DocumentWithRequirement[] = [];
  let recommendedPathways: RecommendedPathway[] = [];

  if (appWithPathway) {
    const [stepsResult, docsResult] = await Promise.all([
      db
        .from('pathway_steps')
        .select('*')
        .eq('pathway_id', appWithPathway.pathway_id)
        .order('step_number', { ascending: true }),
      db
        .from('application_documents')
        .select(`
          id,
          status,
          requirement:document_requirements (
            name,
            is_mandatory
          )
        `)
        .eq('application_id', appWithPathway.id),
    ]);

    if (stepsResult.error) {
      throw new DatabaseError('Failed to fetch pathway steps', { pathwayId: appWithPathway.pathway_id }, stepsResult.error);
    }
    if (docsResult.error) {
      throw new DatabaseError('Failed to fetch documents', { applicationId: appWithPathway.id }, docsResult.error);
    }

    pathwaySteps = (stepsResult.data ?? []) as Tables<'pathway_steps'>[];
    // Untyped client infers requirement as any[] despite being a FK object — cast via unknown.
    rawDocuments = (docsResult.data ?? []) as unknown as DocumentWithRequirement[];
  } else if (profile.onboarding_status === 'complete') {
    const { data: pathwaysData, error: pathwaysError } = await db
      .from('pathways')
      .select('id, title, official_name, processing_time_min, processing_time_max')
      .eq('is_active', true)
      .limit(3);

    if (pathwaysError) {
      throw new DatabaseError('Failed to fetch recommended pathways', { userId }, pathwaysError);
    }

    const pathways = (pathwaysData ?? []) as PathwaySnapshot[];
    recommendedPathways = pathways.map((p) => ({
      id: p.id,
      name: p.title,
      processingTime: formatProcessingTime(p.processing_time_min, p.processing_time_max),
      eligibilityStatus: 'eligible' as const,
    }));
  }

  // Derive documents list
  const documents: DashboardDocument[] = rawDocuments
    .filter((d) => d.requirement !== null)
    .map((d) => ({
      id: d.id,
      name: d.requirement!.name,
      isMandatory: d.requirement!.is_mandatory,
      status: d.status,
    }));

  const isSubmitted = state === 'application_submitted';
  const applicationSteps = deriveApplicationSteps(pathwaySteps, rawDocuments, isSubmitted);

  const mandatoryDocs = documents.filter((d) => d.isMandatory);
  const completedDocumentsCount = mandatoryDocs.filter(
    (d) => d.status === 'uploaded' || d.status === 'verified'
  ).length;
  const pendingDocumentsCount = mandatoryDocs.length - completedDocumentsCount;

  let completedStepsCount = applicationSteps.filter((s) => s.status === 'complete').length;
  let totalStepsCount = applicationSteps.length;

  // Step 4: fetch selected pathway by slug when no application exists yet
  let selectedPathwaySlug: string | null = null;
  let selectedPathwayTitle: string | null = null;
  let selectedPathwayProcessingTime: string | null = null;
  let selectedPathwayDescription: string | null = null;
  let selectedPathwaySteps: ApplicationStep[] = [];

  const rawSlug = (profile as Record<string, unknown>).selected_pathway_slug;
  if (typeof rawSlug === 'string' && rawSlug.length > 0 && !appWithPathway) {
    selectedPathwaySlug = rawSlug;

    const { data: slugPathwayData } = await db
      .from('pathways')
      .select('id, title, description, processing_time_min, processing_time_max')
      .eq('slug', selectedPathwaySlug)
      .maybeSingle();

    if (slugPathwayData) {
      const sp = slugPathwayData as {
        id: string;
        title: string;
        description: string | null;
        processing_time_min: string;
        processing_time_max: string;
      };
      selectedPathwayTitle = sp.title;
      selectedPathwayProcessingTime = formatProcessingTime(sp.processing_time_min, sp.processing_time_max);
      selectedPathwayDescription = sp.description ?? null;

      const { data: slugStepsData } = await db
        .from('pathway_steps')
        .select('id, step_number, title, description, estimated_duration, resources')
        .eq('pathway_id', sp.id)
        .order('step_number', { ascending: true });

      const rawSteps = (slugStepsData ?? []) as {
        id: string;
        step_number: number;
        title: string;
        description: string;
        estimated_duration: string;
        resources: StepResource[] | null;
      }[];

      // Fetch step progress for selected pathway (step_id needed to map back)
      const { data: progressRows } = await db
        .from('pathway_progress')
        .select('step_id, status')
        .eq('profile_id', profile.id)
        .eq('pathway_slug', rawSlug as string);

      const progressData = (progressRows ?? []) as { step_id: string; status: string }[];
      const progressMap = new Map(progressData.map((r) => [r.step_id, r.status]));
      const completedFromProgress = progressData.filter((r) => r.status === 'complete').length;

      completedStepsCount = completedFromProgress;
      totalStepsCount = rawSteps.length;

      // Apply per-step statuses: completed steps stay complete; the first non-complete
      // step becomes current; the rest are upcoming.
      let foundCurrentStep = false;
      selectedPathwaySteps = rawSteps.map((s): EnrichedApplicationStep => {
        let status: 'complete' | 'current' | 'upcoming';
        if (progressMap.get(s.id) === 'complete') {
          status = 'complete';
        } else if (!foundCurrentStep) {
          status = 'current';
          foundCurrentStep = true;
        } else {
          status = 'upcoming';
        }
        return {
          id: s.id,
          stepNumber: s.step_number,
          label: s.title,
          description: s.description,
          estimatedDuration: s.estimated_duration,
          status,
          resources: Array.isArray(s.resources) ? s.resources : [],
        };
      });
    }
  }

  // Fetch the most recent draw that matches the user's Express Entry stream.
  // Filter by draw_type so a PNP cutoff (~800+) is never shown next to an FSW CRS score.
  // FLAG: immigration_draws table may lack FSW/CEC stream data.
  // Scraper needed: target https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/submit-profile/rounds-invitations/rounds-results.html
  // Use curl_cffi with impersonate='chrome136'. Parse: draw date, CRS cutoff, draw type, invitations issued.
  // Upsert to immigration_draws with program='express_entry' and draw_type populated ('FSW', 'CEC', 'FST', 'PNP', 'No Program Specified').
  const effectivePathwaySlug =
    (appWithPathway?.pathway as PathwaySnapshot | null)?.slug ?? selectedPathwaySlug ?? null;
  const drawTypes = getDrawTypesForPathway(effectivePathwaySlug);

  const { data: drawData } = await db
    .from('immigration_draws')
    .select('cutoff_score, draw_date, draw_type, invitations_issued')
    .eq('program', 'express_entry')
    .in('draw_type', drawTypes)
    .order('draw_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestDraw: LatestDraw | null = drawData
    ? {
        cutoffScore: (drawData as { cutoff_score: number }).cutoff_score,
        drawDate: (drawData as { draw_date: string }).draw_date,
        drawType: (drawData as { draw_type: string | null }).draw_type,
        invitationsIssued: (drawData as { invitations_issued: number | null }).invitations_issued,
      }
    : null;

  // Extract nationality from voice JSON when profile column is unpopulated
  const pathwayInputPersonal = (pathwayInput as Record<string, unknown> | null)
    ?.personal as Record<string, unknown> | null ?? null;
  const nationalityVoice =
    (pathwayInputPersonal?.nationality as string | null | undefined) ?? null;

  // Resolve the user's name: prefer the dedicated column; fall back to
  // voice_session_data.full_name for users whose profile predates the column write
  // or whose voice session completed without extracting a name into profiles.full_name.
  const voiceSessionData = profile.voice_session_data as Record<string, unknown> | null;
  const voiceFullName =
    typeof voiceSessionData?.full_name === 'string' ? voiceSessionData.full_name : null;
  const resolvedFullName = profile.full_name ?? voiceFullName;

  const profileCtx = profile as Record<string, unknown>;
  const profileContext: ProfileContext = {
    fullName: resolvedFullName,
    occupation: (profileCtx.occupation as string | null | undefined) ?? null,
    degreeLevel: (profileCtx.degree_level as string | null | undefined) ?? null,
    degreeField: (profileCtx.degree_field as string | null | undefined) ?? null,
    nationality: (profileCtx.nationality as string | null | undefined) ?? null,
  };

  const data: DashboardData = {
    state,
    firstName: firstName(resolvedFullName),
    avatarInitials: avatarInitials(resolvedFullName),
    profileCompleteness: profile.profile_completeness_pct ?? 0,
    onboardingStatus: profile.onboarding_status,
    incompleteFields: profile.incomplete_fields ?? [],
    onboardingSteps: deriveOnboardingSteps(profile),
    recommendedPathways,
    applicationId: appWithPathway?.id ?? null,
    applicationStatus: appWithPathway?.status ?? null,
    applicationSubmittedAt: appWithPathway?.submitted_at ?? null,
    pathwayTitle: appWithPathway?.pathway?.title ?? null,
    pathwayOfficialName: appWithPathway?.pathway?.official_name ?? null,
    processingTimeMin: appWithPathway?.pathway?.processing_time_min ?? null,
    processingTimeMax: appWithPathway?.pathway?.processing_time_max ?? null,
    applicationSteps,
    documents,
    completedStepsCount,
    totalStepsCount,
    pendingDocumentsCount,
    completedDocumentsCount,
    recommendations: deriveRecommendations(profile),
    crsScore,
    crsRangeLow,
    crsRangeHigh,
    crsConfidence,
    selectedPathwaySlug,
    selectedPathwayTitle,
    selectedPathwayProcessingTime,
    selectedPathwayDescription,
    selectedPathwaySteps,
    profileContext,
    nationalityVoice,
    latestDraw,
    applicationPathwaySlug: appWithPathway?.pathway?.slug ?? null,
  };

  logger.info({
    action: 'getDashboardData.complete',
    userId,
    state,
    completedStepsCount,
    totalStepsCount,
  });

  return data;
}
