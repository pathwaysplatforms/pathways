import type { Logger } from 'pino';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DatabaseError, NotFoundError } from '@/lib/errors';
import type { Tables } from '@/types/database';
import type { ProfileTabData } from './types';

/** Builds a two-character avatar monogram from a full name. */
export function buildAvatarInitials(fullName: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return (parts[0]?.[0] ?? '?').toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

/** Extracts the first name from a full name string. */
export function buildFirstName(fullName: string | null): string {
  if (!fullName) return 'there';
  return fullName.split(' ')[0] ?? 'there';
}

/**
 * Fetches all profile data required to render the Profile tab.
 * Throws NotFoundError if the profile does not exist, DatabaseError on query failure.
 */
export async function getProfileTabData(userId: string, logger: Logger): Promise<ProfileTabData> {
  logger.info({ action: 'getProfileTabData.start', userId });

  const db = createSupabaseServerClient() as unknown as SupabaseClient;

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

  const { data: appData, error: appError } = await db
    .from('applications')
    .select('id')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (appError) {
    throw new DatabaseError('Failed to fetch application', { userId, profileId: profile.id }, appError);
  }

  const application = appData as { id: string } | null;

  const result: ProfileTabData = {
    id: profile.id,
    avatarInitials: buildAvatarInitials(profile.full_name),
    firstName: buildFirstName(profile.full_name),
    applicationId: application?.id ?? null,

    fullName: profile.full_name,
    nationality: profile.nationality,
    dateOfBirth: profile.date_of_birth,
    currentCountry: profile.current_country,
    maritalStatus: profile.marital_status,

    occupation: profile.occupation,
    nocCode: profile.noc_code,
    nocTeerCategory: profile.noc_teer_category,
    yearsExperience: profile.years_experience,
    hasCanadianExperience: profile.has_canadian_experience,

    educationLevel: profile.education_level_voice ?? profile.education_level,
    degreeLevel: profile.degree_level,
    degreeField: profile.degree_field,
    ecaObtained: profile.eca_obtained,

    clbListening: profile.clb_listening,
    clbReading: profile.clb_reading,
    clbSpeaking: profile.clb_speaking,
    clbWriting: profile.clb_writing,
    englishLevel: profile.english_level,

    annualIncome: profile.annual_income,
    incomeCurrency: profile.income_currency,

    intendedProvince: profile.intended_province,
    hasFamilyInCanada: profile.has_family_in_canada,
    hasProvincialNomination: profile.has_provincial_nomination,

    profileCompletenessPct: profile.profile_completeness_pct,
  };

  logger.info({ action: 'getProfileTabData.complete', userId });
  return result;
}
