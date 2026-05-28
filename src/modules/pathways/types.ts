export type StepType = 'document_upload' | 'information' | 'external_action' | 'review';
export type StepStatus = 'completed' | 'current' | 'upcoming' | 'blocked';

export interface DocumentRequirement {
  name: string;
  description: string;
  document_type: string;
  validity_period: string | null;
  accepted_formats: string[];
  max_size_mb: number;
}

export interface ApplicationStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  type: StepType;
  status: StepStatus;
  estimated_duration: string;
  is_optional: boolean;
  document?: DocumentRequirement;
}

export interface ApplicationPathway {
  slug: string;
  title: string;
  official_name: string;
}

// ─── Pathway Matcher types ──────────────────────────────────────────────────

/** Profile shape the matcher receives — maps directly to profiles table columns. */
export interface MatcherProfile {
  id: string;
  // Core eligibility
  has_degree: boolean | null;
  years_experience: number | null;
  education_level: string | null;
  eca_obtained: boolean | null;
  // Language
  clb_speaking: number | null;
  clb_listening: number | null;
  clb_reading: number | null;
  clb_writing: number | null;
  // Work split
  canadian_work_years: number | null;
  foreign_work_years: number | null;
  canadian_work_recent: boolean | null;
  foreign_work_recent: boolean | null;
  noc_teer_category: number | null;
  // Spouse
  spouse_coming_to_canada: boolean | null;
  spouse_education_level: string | null;
  spouse_clb_speaking: number | null;
  spouse_clb_listening: number | null;
  spouse_clb_reading: number | null;
  spouse_clb_writing: number | null;
  spouse_canadian_work_years: number | null;
  // CRS bonus factors
  has_provincial_nomination: boolean | null;
  has_canadian_job_offer: boolean | null;
  has_sibling_in_canada: boolean | null;
  // Age (IRCC CRS section A — up to 110 pts for single, 100 for with-spouse)
  date_of_birth: string | null;
}

/** A single ranked pathway match result — computed on demand, never stored. */
export interface MatchResult {
  pathway: {
    id: string;
    slug: string;
    title: string;
    official_name: string;
    description: string;
    processing_time_min: string;
    processing_time_max: string;
    program_type: string;
  };
  eligible: boolean;
  crs_score: number;
  ita_likelihood: 'high' | 'medium' | 'low' | 'unknown';
  latest_cutoff: number | null;
  latest_draw_date: string | null;
  criteria_met: string[];
  criteria_missing: string[];
  missing_data: string[];
}

/** Full application record — real or mocked. */
export interface Application {
  id: string;
  pathway: ApplicationPathway;
  status: string;
  steps: ApplicationStep[];
}

/** Database-sourced application record. Extends Application with submission metadata. */
export interface ApplicationData extends Application {
  submitted_at: string | null;
}
