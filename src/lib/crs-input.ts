import type { VoiceExtractedProfile } from '@/modules/voice/types';

/**
 * Column subset of a profiles row needed to build a CRS estimation input.
 * Every field is optional so both full Tables<'profiles'> rows and narrow
 * selects satisfy it structurally.
 */
export interface CrsProfileSource {
  date_of_birth?: string | null;
  education_level?: string | null;
  eca_obtained?: boolean | null;
  clb_speaking?: number | null;
  clb_listening?: number | null;
  clb_reading?: number | null;
  clb_writing?: number | null;
  language_proficiency_self?: string | null;
  canadian_work_years?: number | null;
  foreign_work_years?: number | null;
  foreign_work_recent?: boolean | null;
  years_experience?: number | null;
  noc_teer_category?: number | null;
  noc_code?: string | null;
  has_provincial_nomination?: boolean | null;
  has_canadian_job_offer?: boolean | null;
  has_sibling_in_canada?: boolean | null;
  spouse_coming_to_canada?: boolean | null;
  spouse_clb_speaking?: number | null;
  spouse_clb_listening?: number | null;
  spouse_clb_reading?: number | null;
  spouse_clb_writing?: number | null;
  spouse_canadian_work_years?: number | null;
}

/**
 * Maps a profiles row to the Partial<VoiceExtractedProfile> input that
 * computeCrsEstimate expects. Single source for the column → estimator
 * mapping (used by the dashboard service and the CRS recalculation action).
 */
export function profileRowToCrsInput(row: CrsProfileSource): Partial<VoiceExtractedProfile> {
  return {
    date_of_birth: row.date_of_birth ?? null,
    // Columns store free-form strings; the estimator only scores values that
    // match its lookup tables, so narrowing to the enum union is safe here.
    education_level: (row.education_level as VoiceExtractedProfile['education_level']) ?? undefined,
    eca_obtained: row.eca_obtained ?? undefined,
    clb_speaking: row.clb_speaking ?? undefined,
    clb_listening: row.clb_listening ?? undefined,
    clb_reading: row.clb_reading ?? undefined,
    clb_writing: row.clb_writing ?? undefined,
    language_proficiency_self:
      (row.language_proficiency_self as VoiceExtractedProfile['language_proficiency_self']) ?? undefined,
    canadian_work_years: row.canadian_work_years ?? undefined,
    foreign_work_years: row.foreign_work_years ?? undefined,
    foreign_work_recent: row.foreign_work_recent ?? undefined,
    years_experience: row.years_experience ?? undefined,
    noc_teer_category: row.noc_teer_category ?? undefined,
    noc_code: row.noc_code ?? undefined,
    has_provincial_nomination: row.has_provincial_nomination ?? undefined,
    has_canadian_job_offer: row.has_canadian_job_offer ?? undefined,
    has_sibling_in_canada: row.has_sibling_in_canada ?? undefined,
    spouse_coming_to_canada: row.spouse_coming_to_canada ?? undefined,
    spouse_clb_speaking: row.spouse_clb_speaking ?? undefined,
    spouse_clb_listening: row.spouse_clb_listening ?? undefined,
    spouse_clb_reading: row.spouse_clb_reading ?? undefined,
    spouse_clb_writing: row.spouse_clb_writing ?? undefined,
    spouse_canadian_work_years: row.spouse_canadian_work_years ?? undefined,
  };
}
