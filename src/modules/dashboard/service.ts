import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { Tables } from '@/types/database';
import type {
  DashboardData,
  DashboardState,
  ApplicationStep,
  DashboardDocument,
  OnboardingStep,
  Recommendation,
  RecommendedPathway,
} from './types';
import { ONBOARDING_STEPS_META, STEP_FIELDS } from './types';

/** Pathway fields selected in joined application query. */
interface PathwaySnapshot {
  id: string;
  title: string;
  official_name: string;
  processing_time_min: string;
  processing_time_max: string;
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
  if (!application) return 'pathway_not_selected';
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
  const db = createSupabaseServerClient() as unknown as SupabaseClient;

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

  // Step 2: fetch application joined with pathway
  const { data: applicationData, error: applicationError } = await db
    .from('applications')
    .select(`
      *,
      pathway:pathways (
        id,
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

  const completedStepsCount = applicationSteps.filter((s) => s.status === 'complete').length;
  const totalStepsCount = applicationSteps.length;

  const data: DashboardData = {
    state,
    firstName: firstName(profile.full_name),
    avatarInitials: avatarInitials(profile.full_name),
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
