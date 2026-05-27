import type { Tables } from '@/types/database';

export type DashboardState =
  | 'onboarding_incomplete'
  | 'pathway_not_selected'
  | 'application_in_progress'
  | 'application_submitted';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export interface RecommendedPathway {
  id: string;
  name: string;
  processingTime: string;
  eligibilityStatus: 'eligible' | 'likely' | 'possible';
}

export interface ApplicationStep {
  id: string;
  stepNumber: number;
  label: string;
  description: string;
  estimatedDuration: string;
  status: 'complete' | 'current' | 'upcoming';
}

export interface DashboardDocument {
  id: string;
  name: string;
  isMandatory: boolean;
  status: string;
}

export interface Recommendation {
  id: string;
  label: string;
  description: string;
  impactLabel: string;
}

export interface DashboardData {
  state: DashboardState;

  firstName: string;
  avatarInitials: string;
  profileCompleteness: number;

  onboardingStatus: string;
  incompleteFields: string[];
  onboardingSteps: OnboardingStep[];

  recommendedPathways: RecommendedPathway[];

  applicationId: string | null;
  applicationStatus: string | null;
  applicationSubmittedAt: string | null;
  pathwayTitle: string | null;
  pathwayOfficialName: string | null;
  processingTimeMin: string | null;
  processingTimeMax: string | null;
  applicationSteps: ApplicationStep[];
  documents: DashboardDocument[];

  completedStepsCount: number;
  totalStepsCount: number;
  pendingDocumentsCount: number;
  completedDocumentsCount: number;

  recommendations: Recommendation[];
}

/** Onboarding step definitions derived from known profile sections. */
export const ONBOARDING_STEPS_META: Omit<OnboardingStep, 'completed'>[] = [
  { id: 'personal',  label: 'Personal info',    description: 'Name, nationality, current country' },
  { id: 'education', label: 'Education',         description: 'Degree level and field of study' },
  { id: 'work',      label: 'Work experience',   description: 'Years of experience and occupation' },
  { id: 'language',  label: 'Language scores',   description: 'CLB scores from your English test' },
  { id: 'finances',  label: 'Finances',           description: 'Annual salary and financial situation' },
  { id: 'family',    label: 'Family & intent',   description: 'Marital status, dependents, destination' },
];

/** Maps each onboarding step to the profile fields that must be non-null to mark it complete. */
export const STEP_FIELDS: Record<string, (keyof Tables<'profiles'>)[]> = {
  personal:  ['full_name', 'nationality', 'current_country'],
  education: ['education_level', 'has_degree', 'degree_level', 'degree_field'],
  work:      ['years_experience', 'occupation', 'noc_teer_category'],
  language:  ['english_level', 'clb_listening', 'clb_reading', 'clb_speaking', 'clb_writing'],
  finances:  ['annual_income'],
  family:    ['marital_status', 'has_dependents'],
};
