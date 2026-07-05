import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import { computeCrsEstimate, computeClbPlusOneDelta } from '@/lib/crs-estimate';
import { profileRowToCrsInput } from '@/lib/crs-input';
import type { Tables } from '@/types/database';
import type {
  DashboardData,
  DashboardState,
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

/** Raw pathway_steps row including all enrichment columns. */
interface EnrichedStepRow {
  id: string;
  step_number: number;
  title: string;
  description: string;
  estimated_duration: string;
  resources: StepResource[] | null;
  checklist_items: string[] | null;
  pro_tips: string | null;
  official_url: string | null;
  fee_cad: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  form_numbers: string[] | null;
  common_mistakes: string[] | null;
  what_happens_next: string | null;
  validity_period: string | null;
  applicant_portal: string | null;
}

/** Maps a raw enriched pathway_steps row into an EnrichedApplicationStep with the given status. */
function mapEnrichedStep(
  s: EnrichedStepRow,
  status: EnrichedApplicationStep['status']
): EnrichedApplicationStep {
  return {
    id: s.id,
    stepNumber: s.step_number,
    label: s.title,
    description: s.description,
    estimatedDuration: s.estimated_duration,
    status,
    resources: Array.isArray(s.resources) ? s.resources : [],
    checklistItems: Array.isArray(s.checklist_items) && s.checklist_items.length > 0 ? s.checklist_items : null,
    proTips: s.pro_tips ?? null,
    officialUrl: s.official_url ?? null,
    feeCad: s.fee_cad ?? null,
    estimatedDaysMin: s.estimated_days_min ?? null,
    estimatedDaysMax: s.estimated_days_max ?? null,
    formNumbers: Array.isArray(s.form_numbers) && s.form_numbers.length > 0 ? s.form_numbers : null,
    commonMistakes: Array.isArray(s.common_mistakes) && s.common_mistakes.length > 0 ? s.common_mistakes : null,
    whatHappensNext: s.what_happens_next ?? null,
    validityPeriod: s.validity_period ?? null,
    applicantPortal: s.applicant_portal ?? null,
  };
}

/**
 * Derives application steps with statuses from persisted pathway_progress.
 * A step is complete when the whole application is submitted, or when its
 * pathway_progress row is 'complete'. The first non-complete step becomes
 * 'current'; the rest are 'upcoming'. This matches the pathway_progress model
 * written by updateStepProgress so the "mark complete" action advances focus.
 */
function deriveApplicationSteps(
  pathwaySteps: EnrichedStepRow[],
  progressMap: Map<string, string>,
  allSubmitted: boolean
): EnrichedApplicationStep[] {
  if (pathwaySteps.length === 0) return [];

  let foundCurrent = false;
  return pathwaySteps.map((step): EnrichedApplicationStep => {
    let status: EnrichedApplicationStep['status'];
    if (allSubmitted || progressMap.get(step.id) === 'complete') {
      status = 'complete';
    } else if (!foundCurrent) {
      status = 'current';
      foundCurrent = true;
    } else {
      status = 'upcoming';
    }
    return mapEnrichedStep(step, status);
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

  // Live per-factor breakdown and language counterfactual, recomputed from the
  // profile columns already fetched. Persisted crs_estimate shapes A/B carry no
  // breakdown, so mission-control levers derive from this instead.
  const crsInput = profileRowToCrsInput(profile);
  const liveCrsEstimate = computeCrsEstimate(crsInput);
  const crsBreakdown = liveCrsEstimate?.breakdown ?? null;
  const crsClbPlusOneDelta = computeClbPlusOneDelta(crsInput);

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
  let pathwaySteps: EnrichedStepRow[] = [];
  let rawDocuments: DocumentWithRequirement[] = [];
  let recommendedPathways: RecommendedPathway[] = [];
  let applicationProgressMap = new Map<string, string>();

  if (appWithPathway) {
    const appPathwaySlug = appWithPathway.pathway?.slug ?? null;
    const [stepsResult, docsResult, progressResult] = await Promise.all([
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
      // Step status is driven by pathway_progress (the model updateStepProgress writes),
      // so the "mark complete" action advances the current step on the dashboard too.
      appPathwaySlug
        ? db
            .from('pathway_progress')
            .select('step_id, status')
            .eq('profile_id', profile.id)
            .eq('pathway_slug', appPathwaySlug)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (stepsResult.error) {
      throw new DatabaseError('Failed to fetch pathway steps', { pathwayId: appWithPathway.pathway_id }, stepsResult.error);
    }
    if (docsResult.error) {
      throw new DatabaseError('Failed to fetch documents', { applicationId: appWithPathway.id }, docsResult.error);
    }

    pathwaySteps = (stepsResult.data ?? []) as EnrichedStepRow[];
    // Untyped client infers requirement as any[] despite being a FK object — cast via unknown.
    rawDocuments = (docsResult.data ?? []) as unknown as DocumentWithRequirement[];
    const progressRows = (progressResult.data ?? []) as { step_id: string; status: string }[];
    applicationProgressMap = new Map(progressRows.map((r) => [r.step_id, r.status]));
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
  const applicationSteps = deriveApplicationSteps(pathwaySteps, applicationProgressMap, isSubmitted);

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
  let selectedPathwaySteps: EnrichedApplicationStep[] = [];

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
        .select('id, step_number, title, description, estimated_duration, resources, checklist_items, pro_tips, official_url, fee_cad, estimated_days_min, estimated_days_max, form_numbers, common_mistakes, what_happens_next, validity_period, applicant_portal')
        .eq('pathway_id', sp.id)
        .order('step_number', { ascending: true });

      const rawSteps = (slugStepsData ?? []) as EnrichedStepRow[];

      // Fetch step progress for selected pathway (step_id needed to map back)
      const { data: progressRows } = await db
        .from('pathway_progress')
        .select('step_id, status')
        .eq('profile_id', profile.id)
        .eq('pathway_slug', rawSlug as string);

      const progressData = (progressRows ?? []) as { step_id: string; status: string }[];
      const progressMap = new Map(progressData.map((r) => [r.step_id, r.status]));

      selectedPathwaySteps = deriveApplicationSteps(rawSteps, progressMap, false);
      completedStepsCount = selectedPathwaySteps.filter((s) => s.status === 'complete').length;
      totalStepsCount = selectedPathwaySteps.length;
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
    crsBreakdown,
    crsClbPlusOneDelta,
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
