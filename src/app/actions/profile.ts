'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRequestLogger } from '@/lib/logger';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthError, DatabaseError, ValidationError } from '@/lib/errors';
import {
  EducationLevelEnum,
  ClbScoreSchema,
  NocTeerCategorySchema,
} from '@/modules/voice/types';
import { computeCrsEstimate, type CrsEstimate } from '@/lib/crs-estimate';
import { profileRowToCrsInput } from '@/lib/crs-input';
import { computeProfileCompletenessPct } from '@/lib/completeness';

const ProfileUpdateSchema = z.object({
  full_name: z.string().min(1).max(200).nullable().optional(),
  nationality: z.string().max(100).nullable().optional(),
  current_country: z.string().max(100).nullable().optional(),
  occupation: z.string().max(200).nullable().optional(),
  years_experience: z.number().int().min(0).max(60).nullable().optional(),
  education_level_voice: z.string().max(100).nullable().optional(),
  education_level: EducationLevelEnum.nullable().optional(),
  degree_field: z.string().max(200).nullable().optional(),
  eca_obtained: z.boolean().nullable().optional(),
  intended_province: z.string().max(100).nullable().optional(),
  income_currency: z.string().length(3).nullable().optional(),
  clb_listening: ClbScoreSchema.nullable().optional(),
  clb_reading: ClbScoreSchema.nullable().optional(),
  clb_speaking: ClbScoreSchema.nullable().optional(),
  clb_writing: ClbScoreSchema.nullable().optional(),
  noc_teer_category: NocTeerCategorySchema.nullable().optional(),
  noc_code: z.string().max(20).nullable().optional(),
  canadian_work_years: z.number().int().min(0).max(60).nullable().optional(),
  foreign_work_years: z.number().int().min(0).max(60).nullable().optional(),
  canadian_work_recent: z.boolean().nullable().optional(),
  foreign_work_recent: z.boolean().nullable().optional(),
  spouse_coming_to_canada: z.boolean().nullable().optional(),
  spouse_education_level: EducationLevelEnum.nullable().optional(),
  spouse_clb_listening: ClbScoreSchema.nullable().optional(),
  spouse_clb_reading: ClbScoreSchema.nullable().optional(),
  spouse_clb_speaking: ClbScoreSchema.nullable().optional(),
  spouse_clb_writing: ClbScoreSchema.nullable().optional(),
  spouse_canadian_work_years: z.number().int().min(0).max(60).nullable().optional(),
  has_canadian_job_offer: z.boolean().nullable().optional(),
  has_sibling_in_canada: z.boolean().nullable().optional(),
  has_canadian_experience: z.boolean().nullable().optional(),
  has_provincial_nomination: z.boolean().nullable().optional(),
  has_family_in_canada: z.boolean().nullable().optional(),
});

export type ProfileUpdateFields = z.infer<typeof ProfileUpdateSchema>;

/** Updates mutable profile fields submitted from the Profile tab edit form. */
export async function updateProfileFields(fields: ProfileUpdateFields): Promise<void> {
  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const correlationId = `profile-update-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'updateProfileFields.start', userId: user.id });

  const parsed = ProfileUpdateSchema.safeParse(fields);
  if (!parsed.success) {
    logger.warn({ action: 'updateProfileFields.validation_failed', userId: user.id, errors: parsed.error.issues });
    throw new ValidationError('Invalid profile fields', { issues: parsed.error.issues });
  }

  const updates = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  // Nulling the voice override ensures reads consistently prefer the structured field.
  if ('education_level' in updates) {
    updates['education_level_voice'] = null;
  }

  if (Object.keys(updates).length === 0) {
    logger.info({ action: 'updateProfileFields.no_changes', userId: user.id });
    return;
  }

  const { data: updatedRow, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('auth_user_id', user.id)
    .select(
      'full_name,date_of_birth,nationality,current_country,marital_status,occupation,noc_teer_category,' +
      'years_experience,canadian_work_years,foreign_work_years,education_level,eca_obtained,' +
      'clb_speaking,clb_listening,clb_reading,clb_writing,intended_province,has_provincial_nomination,' +
      'has_canadian_job_offer'
    )
    .single();

  if (error) {
    logger.error({ action: 'updateProfileFields.db_error', userId: user.id, error });
    throw new DatabaseError('Failed to update profile', { userId: user.id }, error);
  }

  // Field edits move voice-field completeness; recompute from the merged row so
  // profile_completeness_pct never goes stale after onboarding.
  const merged = updatedRow as Parameters<typeof computeProfileCompletenessPct>[0];
  const profileCompletenessPct = computeProfileCompletenessPct(merged);

  const { error: pctError } = await supabase
    .from('profiles')
    .update({ profile_completeness_pct: profileCompletenessPct })
    .eq('auth_user_id', user.id);

  if (pctError) {
    logger.error({ action: 'updateProfileFields.pct_error', userId: user.id, error: pctError });
    throw new DatabaseError('Failed to update profile completeness', { userId: user.id }, pctError);
  }

  logger.info({ action: 'updateProfileFields.complete', userId: user.id, profileCompletenessPct });
}

/** Re-computes the CRS estimate from the current profile and persists it into pathway_input_json. */
export async function recalculateCrsEstimate(): Promise<CrsEstimate | null> {
  const supabase = await createSupabaseServerClient() as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AuthError('Not authenticated');

  const correlationId = `crs-recalc-${user.id}-${Date.now()}`;
  const logger = createRequestLogger(correlationId);
  logger.info({ action: 'recalculateCrsEstimate.start', userId: user.id });

  const { data: profileData, error: fetchError } = await supabase
    .from('profiles')
    .select(
      'date_of_birth,education_level,eca_obtained,clb_speaking,clb_listening,clb_reading,clb_writing,' +
      'language_proficiency_self,canadian_work_years,foreign_work_years,foreign_work_recent,' +
      'years_experience,noc_teer_category,noc_code,has_provincial_nomination,has_canadian_job_offer,' +
      'has_sibling_in_canada,spouse_coming_to_canada,spouse_clb_speaking,spouse_clb_listening,' +
      'spouse_clb_reading,spouse_clb_writing,spouse_canadian_work_years,pathway_input_json'
    )
    .eq('auth_user_id', user.id)
    .single();

  if (fetchError || !profileData) {
    logger.error({ action: 'recalculateCrsEstimate.fetch_error', userId: user.id, error: fetchError });
    throw new DatabaseError('Failed to fetch profile for CRS recalculation', { userId: user.id }, fetchError ?? undefined);
  }

  type ProfileRow = {
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
    pathway_input_json: unknown;
  };
  const profile = profileData as unknown as ProfileRow;

  const estimate = computeCrsEstimate(profileRowToCrsInput(profile));

  if (estimate !== null) {
    const currentJson = (profile.pathway_input_json as Record<string, unknown> | null) ?? {};
    const updatedJson: Record<string, unknown> = {
      ...currentJson,
      crs_estimate: estimate,
      crs_recalculated_at: new Date().toISOString(),
    };

    const { error: writeError } = await supabase
      .from('profiles')
      .update({ pathway_input_json: updatedJson })
      .eq('auth_user_id', user.id);

    if (writeError) {
      logger.error({ action: 'recalculateCrsEstimate.write_error', userId: user.id, error: writeError });
      throw new DatabaseError('Failed to persist CRS estimate', { userId: user.id }, writeError);
    }
  }

  logger.info({ action: 'recalculateCrsEstimate.complete', userId: user.id, score: estimate?.score ?? null });
  return estimate;
}
