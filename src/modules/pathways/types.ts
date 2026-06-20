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

/** Full application record — real or mocked. */
export interface Application {
  id: string;
  pathway: ApplicationPathway;
  status: string;
  steps: ApplicationStep[];
}
