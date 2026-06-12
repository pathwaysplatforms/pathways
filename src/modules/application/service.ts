import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { EnrichedApplicationStep, StepResource } from '@/modules/dashboard/types';
import type { ApplicationPageData, ApplicationDocument } from './types';

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

/** Raw pathway_steps row from DB. */
interface PathwayStepRow {
  id: string;
  step_number: number;
  title: string;
  description: string;
  estimated_duration: string;
  is_optional: boolean;
  resources: StepResource[] | null;
}

/** Raw document_requirements row from DB. */
interface DocumentRequirementRow {
  id: string;
  name: string;
  is_mandatory: boolean;
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
 * Fetches full pathway detail, steps, and document requirements for the
 * user's selected pathway. Returns null if no pathway slug is set on the
 * profile or if the slug doesn't match any active pathway.
 */
export async function getApplicationData(
  userId: string,
  logger: Logger
): Promise<ApplicationPageData | null> {
  logger.info({ action: 'getApplicationData.start', userId });

  // The typed Supabase client produces `never` for query data — cast to untyped,
  // assert result types manually (mirrors dashboard/service.ts pattern).
  const db = createSupabaseServerClient() as unknown as SupabaseClient;

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

  if (!profile.selected_pathway_slug) {
    logger.info({ action: 'getApplicationData.noPathway', userId });
    return null;
  }

  const slug = profile.selected_pathway_slug;

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

  const pathway = pathwayData as PathwayRow;

  const [stepsResult, docsResult] = await Promise.all([
    db
      .from('pathway_steps')
      .select('id, step_number, title, description, estimated_duration, is_optional, resources')
      .eq('pathway_id', pathway.id)
      .order('step_number', { ascending: true }),
    db
      .from('document_requirements')
      .select('id, name, is_mandatory')
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

  // Load persisted progress for these steps.
  const stepIds = rawSteps.map((s) => s.id);
  const { data: progressData, error: progressError } = await db
    .from('pathway_progress')
    .select('step_id, status')
    .eq('profile_id', profile.id)
    .eq('pathway_slug', slug)
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
    };
  });

  const documents: ApplicationDocument[] = rawDocs.map((d) => ({
    id: d.id,
    name: d.name,
    isMandatory: d.is_mandatory,
    stepId: null,
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
    pathwaySlug: slug,
    stepCount: steps.length,
    documentCount: documents.length,
  });

  return data;
}
