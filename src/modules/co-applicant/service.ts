import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError, ValidationError } from '@/lib/errors';
import { CreateCoApplicantInputSchema } from './types';
import type { CreateCoApplicantInput, CoApplicantProfile, AccessibleProfileSummary } from './types';

/** Raw profiles row used when resolving the caller's own profile id. */
interface OwnerProfileRow {
  id: string;
}

/** Raw profiles row as returned by the accessible-profiles list query. */
interface AccessibleProfileRow {
  id: string;
  full_name: string | null;
  auth_user_id: string | null;
}

/**
 * Creates a new co-applicant profile owned by the authenticated user's own
 * profile. The co-applicant profile has no auth_user_id — it can never sign
 * in on its own, only be managed through the owner's account.
 */
export async function createCoApplicantProfile(
  authUserId: string,
  input: CreateCoApplicantInput,
  log: Logger,
): Promise<CoApplicantProfile> {
  log.info({ action: 'coApplicant.create.start', authUserId });

  const parsed = CreateCoApplicantInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError('Invalid co-applicant details', { issues: parsed.error.issues });
  }

  // supabase types are stale pending `supabase gen types --local`
  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

  const { data: ownerProfileData, error: ownerError } = await db
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .single();

  if (ownerError || !ownerProfileData) {
    throw new NotFoundError('Owner profile not found', { authUserId });
  }

  const ownerProfileId = (ownerProfileData as OwnerProfileRow).id;

  const { data, error } = await db
    .from('profiles')
    .insert({
      owner_profile_id: ownerProfileId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      onboarding_status: 'not_started',
    })
    .select('id, full_name, email, onboarding_status')
    .single();

  if (error || !data) {
    throw new DatabaseError(
      'Failed to create co-applicant profile',
      { authUserId, ownerProfileId },
      error ?? undefined,
    );
  }

  const coApplicant = data as CoApplicantProfile;

  log.info({
    action: 'coApplicant.create.complete',
    authUserId,
    ownerProfileId,
    coApplicantProfileId: coApplicant.id,
  });

  return coApplicant;
}

/**
 * Lists every profile the authenticated user may act as: their own profile,
 * plus any co-applicant profiles they own. Relies on RLS (accessible_profile_ids)
 * to scope the result — no explicit filter is applied here.
 */
export async function listAccessibleProfiles(
  authUserId: string,
  log: Logger,
): Promise<AccessibleProfileSummary[]> {
  log.info({ action: 'coApplicant.list.start', authUserId });

  const db = await createSupabaseServerClient() as unknown as SupabaseClient;

  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, auth_user_id')
    .order('created_at', { ascending: true });

  if (error) {
    throw new DatabaseError('Failed to fetch accessible profiles', { authUserId }, error);
  }

  const rows = (data ?? []) as AccessibleProfileRow[];
  const summaries: AccessibleProfileSummary[] = rows.map((r) => ({
    profileId: r.id,
    fullName: r.full_name,
    isOwner: r.auth_user_id === authUserId,
  }));

  log.info({ action: 'coApplicant.list.complete', authUserId, count: summaries.length });

  return summaries;
}
