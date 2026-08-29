/**
 * Compute the voice-field completeness percentage for a user profile.
 * Denominator is the 19 key CRS-relevant fields that voice collects after trimming.
 * Spouse/conditional fields are excluded so non-married users aren't penalised.
 */
export function computeProfileCompletenessPct(profile: {
  full_name?: string | null;
  date_of_birth?: string | null;
  nationality?: string | null;
  current_country?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  noc_teer_category?: number | null;
  years_experience?: number | null;
  canadian_work_years?: number | null;
  foreign_work_years?: number | null;
  education_level?: string | null;
  eca_obtained?: boolean | null;
  clb_speaking?: number | null;
  clb_listening?: number | null;
  clb_reading?: number | null;
  clb_writing?: number | null;
  intended_province?: string | null;
  has_provincial_nomination?: boolean | null;
  has_canadian_job_offer?: boolean | null;
}): number {
  const fields = [
    profile.full_name,
    profile.date_of_birth,
    profile.nationality,
    profile.current_country,
    profile.marital_status,
    profile.occupation,
    profile.noc_teer_category,
    profile.years_experience,
    profile.canadian_work_years,
    profile.foreign_work_years,
    profile.education_level,
    profile.eca_obtained,
    profile.clb_speaking,
    profile.clb_listening,
    profile.clb_reading,
    profile.clb_writing,
    profile.intended_province,
    profile.has_provincial_nomination,
    profile.has_canadian_job_offer,
  ];
  const filled = fields.filter((v) => v !== null && v !== undefined).length;
  return Math.round((filled / fields.length) * 100);
}
