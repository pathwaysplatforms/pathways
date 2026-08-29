import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { EnrichedApplicationStep, StepResource } from '@/modules/dashboard/types';
import { parseChecklistItems } from '@/lib/parse-checklist-items';
import type {
  Application,
  ApplicationStep,
  DocumentRequirement,
  StepType,
  StepStatus,
} from '@/modules/pathways/types';
import type { ApplicationPageData, ApplicationDocument, UserApplicationSummary } from './types';

/** Raw pathway row from DB. */
interface PathwayRow {
  id: string;
  slug: string;
  title: string;
  official_name: string;
  description: string;
  processing_time_min: string;
  processing_time_max: string;
  fee_gbp: number;
}

/** Raw pathway_steps row from DB (used by getApplicationData). */
interface PathwayStepRow {
  id: string;
  step_number: number;
  title: string;
  description: string;
  estimated_duration: string;
  is_optional: boolean;
  resources: StepResource[] | null;
  checklist_items: unknown;
}


/** Raw document_requirements row from DB. */
interface DocumentRequirementRow {
  id: string;
  name: string;
  is_mandatory: boolean;
  document_type: string | null;
}

/** Raw profile row including id, used for progress lookup. */
interface ProfileRow {
  id: string;
  selected_pathway_slug: string | null;
}

/** Raw pathway_progress row from DB. */
interface ProgressRow {
  step_id: string;
  status: string;
}

/** Formats a processing time range into a human-readable string. */
function formatProcessingTime(min: string, max: string): string {
  return `${min}–${max}`;
}

/** Formats application fee for display; returns null when fee is zero. */
function formatFee(feeGbp: number): string | null {
  if (feeGbp <= 0) return null;
  return `GBP ${feeGbp.toLocaleString('en-GB')}`;
}

/**
 * Every profile id the given auth user may act as — their own profile, plus
 * any co-applicant profiles they own. Relies on RLS (accessible_profile_ids)
 * to scope the underlying query; no explicit filter is applied here.
 */
async function getAccessibleProfileIds(db: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data, error } = await db.from('profiles').select('id');

  if (error) {
    throw new DatabaseError('Failed to fetch accessible profiles', { userId }, error);
  }

  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
}

/**
 * Fetches full pathway detail, steps, and document requirements either for a
 * specific application (any profile accessible to the user — their own or a
 * co-applicant's) or, when applicationId is omitted, for the user's own
 * selected pathway. Returns null if no application/pathway can be resolved.
 */
export async function getApplicationData(
  userId: string,
  logger: Logger,
  slugOverride?: string | null,
  applicationId?: string | null,
): Promise<ApplicationPageData | null> {
  logger.info({ action: 'getApplicationData.start', userId, applicationId: applicationId ?? undefined });

  // The typed Supabase client produces `never` for query data — cast to untyped,
  // assert result types manually (mirrors dashboard/service.ts pattern).
  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

  let profileId: string;
  let pathway: PathwayRow;

  if (applicationId) {
    const accessibleProfileIds = await getAccessibleProfileIds(db, userId);

    const { data: appRow, error: appError } = await db
      .from('applications')
      .select('id, profile_id, pathway_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (appError) {
      throw new DatabaseError('Failed to fetch application', { userId, applicationId }, appError);
    }

    const app = appRow as { id: string; profile_id: string; pathway_id: string } | null;

    if (!app || !accessibleProfileIds.has(app.profile_id)) {
      logger.info({ action: 'getApplicationData.applicationNotAccessible', userId, applicationId });
      return null;
    }

    profileId = app.profile_id;

    const { data: pathwayData, error: pathwayError } = await db
      .from('pathways')
      .select('id, slug, title, official_name, description, processing_time_min, processing_time_max, fee_gbp')
      .eq('id', app.pathway_id)
      .maybeSingle();

    if (pathwayError) {
      throw new DatabaseError('Failed to fetch pathway', { userId, applicationId }, pathwayError);
    }
    if (!pathwayData) {
      logger.info({ action: 'getApplicationData.pathwayNotFound', userId, applicationId });
      return null;
    }

    pathway = pathwayData as PathwayRow;
  } else {
    const { data: profileData, error: profileError } = await db
      .from('profiles')
      .select('id, selected_pathway_slug')
      .eq('auth_user_id', userId)
      .single();

    if (profileError) {
      if ((profileError as { code?: string }).code === 'PGRST116') {
        throw new NotFoundError('Profile not found', { userId });
      }
      throw new DatabaseError('Failed to fetch profile', { userId }, profileError);
    }

    const profile = profileData as ProfileRow;
    profileId = profile.id;

    if (!profile.selected_pathway_slug && !slugOverride) {
      logger.info({ action: 'getApplicationData.noPathway', userId });
      return null;
    }

    const slug = slugOverride ?? profile.selected_pathway_slug ?? '';

    const { data: pathwayData, error: pathwayError } = await db
      .from('pathways')
      .select('id, slug, title, official_name, description, processing_time_min, processing_time_max, fee_gbp')
      .eq('slug', slug)
      .maybeSingle();

    if (pathwayError) {
      throw new DatabaseError('Failed to fetch pathway', { userId, slug }, pathwayError);
    }

    if (!pathwayData) {
      logger.info({ action: 'getApplicationData.pathwayNotFound', userId, slug });
      return null;
    }

    pathway = pathwayData as PathwayRow;
  }

  const [stepsResult, docsResult] = await Promise.all([
    db
      .from('pathway_steps')
      .select('id, step_number, title, description, estimated_duration, is_optional, resources, checklist_items')
      .eq('pathway_id', pathway.id)
      .order('step_number', { ascending: true }),
    db
      .from('document_requirements')
      .select('id, name, is_mandatory, document_type')
      .eq('pathway_id', pathway.id)
      .order('sort_order', { ascending: true }),
  ]);

  if (stepsResult.error) {
    throw new DatabaseError(
      'Failed to fetch pathway steps',
      { pathwayId: pathway.id },
      stepsResult.error
    );
  }

  const rawSteps = (stepsResult.data ?? []) as PathwayStepRow[];
  const rawDocs = docsResult.error
    ? []
    : (docsResult.data ?? []) as DocumentRequirementRow[];

  if (docsResult.error) {
    logger.warn({ action: 'getApplicationData.docsFetchFailed', pathwayId: pathway.id, error: docsResult.error });
  }

  // Fetch vault: which document_types has the user already uploaded?
  const { data: vaultData } = await db
    .from('user_documents')
    .select('document_type')
    .eq('user_id', profileId)
    .not('document_type', 'is', null);

  const satisfiedTypes = new Set<string>(
    ((vaultData ?? []) as { document_type: string }[]).map((r) => r.document_type)
  );

  // Load persisted progress for these steps.
  const stepIds = rawSteps.map((s) => s.id);
  const { data: progressData, error: progressError } = await db
    .from('pathway_progress')
    .select('step_id, status')
    .eq('profile_id', profileId)
    .eq('pathway_slug', pathway.slug)
    .in('step_id', stepIds);

  if (progressError) {
    logger.warn({ action: 'getApplicationData.progressFetchFailed', pathwayId: pathway.id, error: progressError });
  }

  const progressMap = new Map<string, string>(
    ((progressData ?? []) as ProgressRow[]).map((r) => [r.step_id, r.status])
  );

  // Count complete steps to determine which step is current when no progress row exists.
  const completeCount = rawSteps.filter((s) => progressMap.get(s.id) === 'complete').length;

  const steps: EnrichedApplicationStep[] = rawSteps.map((s, idx): EnrichedApplicationStep => {
    const persisted = progressMap.get(s.id);
    const status: EnrichedApplicationStep['status'] = persisted !== undefined
      ? (persisted as EnrichedApplicationStep['status'])
      : (idx === completeCount ? 'current' : 'upcoming');
    return {
      id: s.id,
      stepNumber: s.step_number,
      label: s.title,
      description: s.description,
      estimatedDuration: s.estimated_duration,
      status,
      resources: Array.isArray(s.resources) ? s.resources : [],
      checklistItems: parseChecklistItems(s.checklist_items),
    };
  });

  const documents: ApplicationDocument[] = rawDocs.map((d) => ({
    id: d.id,
    name: d.name,
    isMandatory: d.is_mandatory,
    stepId: null,
    documentType: d.document_type ?? null,
    satisfied: d.document_type != null ? satisfiedTypes.has(d.document_type) : false,
  }));

  const data: ApplicationPageData = {
    pathwaySlug: pathway.slug,
    pathwayTitle: pathway.title,
    pathwayOfficialName: pathway.official_name,
    pathwayDescription: pathway.description,
    processingTime: formatProcessingTime(pathway.processing_time_min, pathway.processing_time_max),
    feesDisplay: formatFee(pathway.fee_gbp),
    steps,
    totalSteps: steps.length,
    documents,
  };

  logger.info({
    action: 'getApplicationData.complete',
    userId,
    pathwaySlug: pathway.slug,
    stepCount: steps.length,
    documentCount: documents.length,
  });

  return data;
}

// ─── getUserApplications ────────────────────────────────────────────────────

/** Raw applications row joined with its pathway, for the applications-home list. */
interface UserApplicationRow {
  id: string;
  status: string;
  pathway_id: string;
  profile_id: string;
  pathway: {
    id: string;
    slug: string;
    title: string;
    official_name: string;
    processing_time_min: string;
    processing_time_max: string;
  } | null;
}

/** Raw profiles row for every profile the caller may act as (self + co-applicants). */
interface AccessibleProfileRow {
  id: string;
  full_name: string | null;
  auth_user_id: string | null;
}

/**
 * Fetches every application across every profile the user can act as — their
 * own and any co-applicants they manage — each with its step-completion
 * progress, for the applications-home list. Returns an empty array when none
 * of those profiles have started an application yet.
 */
export async function getUserApplications(
  userId: string,
  logger: Logger,
): Promise<UserApplicationSummary[]> {
  logger.info({ action: 'getUserApplications.start', userId });

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

  // RLS scopes this to exactly the profiles the caller may act as: their own,
  // plus any co-applicant profiles they own.
  const { data: profilesData, error: profilesError } = await db
    .from('profiles')
    .select('id, full_name, auth_user_id');

  if (profilesError) {
    throw new DatabaseError('Failed to fetch accessible profiles', { userId }, profilesError);
  }

  const accessibleProfiles = (profilesData ?? []) as AccessibleProfileRow[];
  const ownProfile = accessibleProfiles.find((p) => p.auth_user_id === userId);
  if (!ownProfile) {
    throw new NotFoundError('Profile not found', { userId });
  }

  const nameByProfileId = new Map(accessibleProfiles.map((p) => [p.id, p.full_name]));
  const profileIds = accessibleProfiles.map((p) => p.id);

  const { data: appsData, error: appsError } = await db
    .from('applications')
    .select(`
      id,
      status,
      pathway_id,
      profile_id,
      pathway:pathways ( id, slug, title, official_name, processing_time_min, processing_time_max )
    `)
    .in('profile_id', profileIds);

  if (appsError) {
    throw new DatabaseError('Failed to fetch applications', { userId }, appsError);
  }

  const rows = ((appsData ?? []) as unknown as UserApplicationRow[]).filter((r) => r.pathway !== null);
  if (rows.length === 0) {
    logger.info({ action: 'getUserApplications.empty', userId });
    return [];
  }

  const pathwayIds = rows.map((r) => r.pathway_id);
  const slugs = rows.map((r) => r.pathway!.slug);

  const [stepsResult, progressResult] = await Promise.all([
    db.from('pathway_steps').select('id, pathway_id').in('pathway_id', pathwayIds),
    db
      .from('pathway_progress')
      .select('profile_id, pathway_slug, status')
      .in('profile_id', profileIds)
      .in('pathway_slug', slugs),
  ]);

  if (stepsResult.error) {
    throw new DatabaseError('Failed to fetch pathway steps', { userId }, stepsResult.error);
  }
  if (progressResult.error) {
    logger.warn({ action: 'getUserApplications.progressFetchFailed', userId, error: progressResult.error });
  }

  const totalByPathwayId = new Map<string, number>();
  for (const s of (stepsResult.data ?? []) as { id: string; pathway_id: string }[]) {
    totalByPathwayId.set(s.pathway_id, (totalByPathwayId.get(s.pathway_id) ?? 0) + 1);
  }

  // Keyed by profile + pathway slug — two different profiles can both apply
  // to the same pathway with independent progress.
  const completedByKey = new Map<string, number>();
  for (const p of (progressResult.data ?? []) as { profile_id: string; pathway_slug: string; status: string }[]) {
    if (p.status !== 'complete') continue;
    const key = `${p.profile_id}|${p.pathway_slug}`;
    completedByKey.set(key, (completedByKey.get(key) ?? 0) + 1);
  }

  const summaries: UserApplicationSummary[] = rows.map((r) => {
    const isOwner = r.profile_id === ownProfile.id;
    const key = `${r.profile_id}|${r.pathway!.slug}`;
    return {
      applicationId: r.id,
      pathwaySlug: r.pathway!.slug,
      pathwayTitle: r.pathway!.title,
      pathwayOfficialName: r.pathway!.official_name,
      processingTime: formatProcessingTime(r.pathway!.processing_time_min, r.pathway!.processing_time_max),
      status: r.status,
      completedSteps: completedByKey.get(key) ?? 0,
      totalSteps: totalByPathwayId.get(r.pathway_id) ?? 0,
      profileId: r.profile_id,
      personName: isOwner ? 'You' : (nameByProfileId.get(r.profile_id) ?? 'Co-applicant'),
    };
  });

  logger.info({ action: 'getUserApplications.complete', userId, count: summaries.length });

  return summaries;
}

// ─── getApplicationForLayout ────────────────────────────────────────────────

/** Raw application row scoped by id + owner. */
interface ApplicationRow {
  id: string;
  profile_id: string;
  pathway_id: string;
  status: string;
  submitted_at: string | null;
}

/** Raw pathway_steps row including the step type and resources. */
interface LayoutStepRow {
  id: string;
  step_number: number;
  title: string;
  description: string;
  estimated_duration: string;
  is_optional: boolean;
  type: string | null;
  resources: unknown;
}

/** Raw document_requirements row including its step link and validation rules. */
interface LayoutDocRow {
  id: string;
  name: string;
  description: string;
  document_type: string;
  validity_period: string | null;
  validation_rules: Record<string, unknown> | null;
  step_id: string | null;
}

const STEP_TYPES: readonly StepType[] = [
  'document_upload',
  'information',
  'external_action',
  'review',
];

/** Coerces a raw step type to a known StepType, defaulting to 'information'. */
function normalizeStepType(raw: string | null): StepType {
  return raw !== null && (STEP_TYPES as readonly string[]).includes(raw)
    ? (raw as StepType)
    : 'information';
}

/** Maps a document_requirements row to the embedded DocumentRequirement shape. */
function mapDocumentRequirement(d: LayoutDocRow, satisfiedTypes: Set<string>): DocumentRequirement {
  const rules = d.validation_rules ?? {};
  const rawFormats = (rules as Record<string, unknown>).accepted_formats;
  const accepted = Array.isArray(rawFormats)
    ? rawFormats.filter((x): x is string => typeof x === 'string')
    : [];
  const rawMax = (rules as Record<string, unknown>).max_size_mb;
  return {
    name: d.name,
    description: d.description,
    document_type: d.document_type,
    validity_period: d.validity_period,
    accepted_formats: accepted.length > 0 ? accepted : ['PDF'],
    max_size_mb: typeof rawMax === 'number' ? rawMax : 10,
    satisfied: satisfiedTypes.has(d.document_type),
  };
}

/**
 * Fetches a single application by id for the ApplicationLayout view, scoped to
 * the requesting user (authz via profile ownership). Returns null when the
 * application does not exist or is not owned by the user.
 */
export async function getApplicationForLayout(
  applicationId: string,
  userId: string,
  logger: Logger
): Promise<Application | null> {
  logger.info({ action: 'getApplicationForLayout.start', userId, applicationId });

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

  const accessibleProfileIds = await getAccessibleProfileIds(db, userId);

  const { data: appData, error: appError } = await db
    .from('applications')
    .select('id, profile_id, pathway_id, status, submitted_at')
    .eq('id', applicationId)
    .maybeSingle();

  if (appError) {
    throw new DatabaseError('Failed to fetch application', { userId, applicationId }, appError);
  }

  // Scope by the caller's accessible profiles (their own, or a co-applicant's
  // they own) so a user can never load another user's application.
  if (!appData || !accessibleProfileIds.has((appData as { profile_id: string }).profile_id)) {
    logger.info({ action: 'getApplicationForLayout.notFound', userId, applicationId });
    return null;
  }

  const application = appData as ApplicationRow;
  const profile = { id: application.profile_id };

  const { data: pathwayData, error: pathwayError } = await db
    .from('pathways')
    .select('id, slug, title, official_name')
    .eq('id', application.pathway_id)
    .maybeSingle();

  if (pathwayError) {
    throw new DatabaseError('Failed to fetch pathway', { applicationId }, pathwayError);
  }

  if (!pathwayData) {
    logger.info({ action: 'getApplicationForLayout.pathwayNotFound', applicationId });
    return null;
  }

  const pathway = pathwayData as {
    id: string;
    slug: string;
    title: string;
    official_name: string;
  };

  const [stepsResult, docsResult] = await Promise.all([
    db
      .from('pathway_steps')
      .select('id, step_number, title, description, estimated_duration, is_optional, type, resources')
      .eq('pathway_id', pathway.id)
      .order('step_number', { ascending: true }),
    db
      .from('document_requirements')
      .select('id, name, description, document_type, validity_period, validation_rules, step_id')
      .eq('pathway_id', pathway.id),
  ]);

  if (stepsResult.error) {
    throw new DatabaseError(
      'Failed to fetch pathway steps',
      { pathwayId: pathway.id },
      stepsResult.error
    );
  }

  const rawSteps = (stepsResult.data ?? []) as LayoutStepRow[];
  const rawDocs = docsResult.error ? [] : ((docsResult.data ?? []) as LayoutDocRow[]);

  if (docsResult.error) {
    logger.warn({
      action: 'getApplicationForLayout.docsFetchFailed',
      pathwayId: pathway.id,
      error: docsResult.error,
    });
  }

  const stepIds = rawSteps.map((s) => s.id);
  const { data: progressData, error: progressError } = await db
    .from('pathway_progress')
    .select('step_id, status')
    .eq('profile_id', profile.id)
    .eq('pathway_slug', pathway.slug)
    .in('step_id', stepIds);

  if (progressError) {
    logger.warn({
      action: 'getApplicationForLayout.progressFetchFailed',
      pathwayId: pathway.id,
      error: progressError,
    });
  }

  const progressMap = new Map<string, string>(
    ((progressData ?? []) as { step_id: string; status: string }[]).map((r) => [
      r.step_id,
      r.status,
    ])
  );

  // Fetch vault satisfaction: which document_type values has the user uploaded?
  const { data: vaultData } = await db
    .from('user_documents')
    .select('document_type')
    .eq('user_id', profile.id)
    .not('document_type', 'is', null);

  const satisfiedTypes = new Set<string>(
    ((vaultData ?? []) as { document_type: string }[]).map((r) => r.document_type)
  );

  // First document requirement linked to a step wins for that step.
  const docByStep = new Map<string, LayoutDocRow>();
  for (const d of rawDocs) {
    if (d.step_id && !docByStep.has(d.step_id)) docByStep.set(d.step_id, d);
  }

  // Completed steps keep their status; the first non-complete step becomes current.
  let foundCurrent = false;
  const steps: ApplicationStep[] = rawSteps.map((s): ApplicationStep => {
    let status: StepStatus;
    if (progressMap.get(s.id) === 'complete') {
      status = 'completed';
    } else if (!foundCurrent) {
      status = 'current';
      foundCurrent = true;
    } else {
      status = 'upcoming';
    }

    const type = normalizeStepType(s.type);
    const linkedDoc = type === 'document_upload' ? docByStep.get(s.id) : undefined;

    const rawResources = s.resources;
    const step: ApplicationStep = {
      id: s.id,
      step_number: s.step_number,
      title: s.title,
      description: s.description,
      type,
      status,
      estimated_duration: s.estimated_duration,
      is_optional: s.is_optional,
      document_requirement_id: linkedDoc?.id ?? null,
      resources: Array.isArray(rawResources) ? (rawResources as StepResource[]) : undefined,
    };
    if (linkedDoc) step.document = mapDocumentRequirement(linkedDoc, satisfiedTypes);
    return step;
  });

  const result: Application = {
    id: application.id,
    pathway: {
      slug: pathway.slug,
      title: pathway.title,
      official_name: pathway.official_name,
    },
    status: application.status,
    steps,
  };

  logger.info({
    action: 'getApplicationForLayout.complete',
    userId,
    applicationId,
    stepCount: steps.length,
  });

  return result;
}
