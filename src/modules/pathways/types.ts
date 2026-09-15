export type StepType = 'document_upload' | 'information' | 'external_action' | 'review';
export type StepStatus = 'completed' | 'current' | 'upcoming' | 'blocked';

export interface DocumentRequirement {
  name: string;
  description: string;
  document_type: string;
  validity_period: string | null;
  accepted_formats: string[];
  max_size_mb: number;
  /** True when the user has a vault file labeled with this document_type. */
  satisfied?: boolean;
}

/** An official link or form associated with a pathway step. */
export interface StepResource {
  label: string;
  url: string;
  type: 'official' | 'form' | 'external';
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
  document_requirement_id: string | null;
  document?: DocumentRequirement;
  resources?: StepResource[];
}

export interface ApplicationPathway {
  slug: string;
  title: string;
  official_name: string;
}

// ─── Pathway Matcher types ──────────────────────────────────────────────────

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
