import type { Tables } from '@/types/database';
import type { CrsBreakdown } from '@/lib/crs-estimate';
import type { FswEstimate } from '@/lib/fsw-points';

export type DashboardState =
  | 'onboarding_incomplete'
  | 'pathway_not_selected'
  | 'pathway_selected'
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

/** An official link or form associated with a pathway step. */
export interface StepResource {
  label: string;
  url: string;
  type: 'official' | 'form' | 'external';
}

/** All AI draft types the checklist system can generate. */
export type AiActionType =
  | 'employer_reference_email'
  | 'eca_inquiry_email'
  | 'eca_status_email'
  | 'language_score_email'
  | 'bank_letter_request_email'
  | 'cover_letter'
  | 'employer_support_email'
  | 'pnp_inquiry_email'
  | 'trade_cert_inquiry_email'
  | 'transcript_request_email'
  | 'designated_org_inquiry_email'
  | 'commitment_letter_follow_up'
  | 'community_recommendation_request'
  | 'sponsorship_support_letter'
  | 'endorsement_inquiry_email';

/** Describes an AI generation action attached to a checklist task. */
export interface ChecklistAiAction {
  /** Which generation function to call. */
  type: AiActionType;
  /** Text on the trigger button inside the expanded row. */
  button_label: string;
  /** Title shown at the top of the output modal. */
  modal_title: string;
}

/** Describes a data-capture field shown inline in a checklist task. */
export interface ChecklistInputField {
  /** Visible label above the input. */
  label: string;
  placeholder: string;
  /** Profile column key: 'noc_code' | 'occupation' | 'annual_income', or an arbitrary key stored in pathway_input_json. */
  key: string;
  /** Displayed below the input as contextual guidance. */
  hint?: string;
  type?: 'text' | 'number';
}

/** A rich checklist sub-task with inline guidance for the expanded drawer. */
export interface ChecklistItem {
  label: string;
  detail: string;
  links?: { label: string; url: string }[];
  tips?: string[];
  /** If set, an input field is rendered so the user can record a value found while completing this task. */
  input_field?: ChecklistInputField;
  /** If set, an AI generation button is rendered in the expanded drawer. */
  ai_action?: ChecklistAiAction;
}

/** A pre-written email template for a pathway step. */
export interface StepEmailTemplate {
  subject: string;
  recipientHint: string;
  body: string;
}

/** ApplicationStep enriched with optional resource and email data. */
export interface EnrichedApplicationStep extends ApplicationStep {
  resources?: StepResource[];
  emailTemplates?: StepEmailTemplate[];
  checklistItems?: ChecklistItem[] | null;
  proTips?: string | null;
  officialUrl?: string | null;
  feeCad?: number | null;
  estimatedDaysMin?: number | null;
  estimatedDaysMax?: number | null;
  formNumbers?: string[] | null;
  commonMistakes?: string[] | null;
  whatHappensNext?: string | null;
  validityPeriod?: string | null;
  applicantPortal?: string | null;
}

/** Minimal profile fields passed to client components for template resolution. */
export interface ProfileContext {
  fullName: string | null;
  occupation: string | null;
  degreeLevel: string | null;
  degreeField: string | null;
  nationality: string | null;
  /** Current value of profiles.noc_code — used to pre-populate checklist input fields. */
  nocCode: string | null;
  /** Current value of profiles.pathway_input_json — used to pre-populate arbitrary checklist inputs. */
  pathwayInputJson: Record<string, string> | null;
}

export interface DashboardDocument {
  id: string;
  name: string;
  isMandatory: boolean;
  status: string;
  /** Vault document_type value (e.g. 'employment_reference') used to tag uploads. Null when unknown. */
  documentType: string | null;
}

export interface Recommendation {
  id: string;
  label: string;
  description: string;
  impactLabel: string;
}

/** Most recent Express Entry draw record from immigration_draws. */
export interface LatestDraw {
  cutoffScore: number;
  drawDate: string;
  drawType: string | null;
  invitationsIssued: number | null;
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
  applicationSteps: EnrichedApplicationStep[];
  documents: DashboardDocument[];

  completedStepsCount: number;
  totalStepsCount: number;
  pendingDocumentsCount: number;
  completedDocumentsCount: number;

  recommendations: Recommendation[];

  crsScore: number | null;
  crsRangeLow: number | null;
  crsRangeHigh: number | null;
  crsConfidence: string | null;
  /** Per-factor CRS breakdown recomputed live from profile columns (null when too few fields to estimate). */
  crsBreakdown: CrsBreakdown | null;
  /** Real CRS delta from raising each provided CLB ability by one level (null when not computable). */
  crsClbPlusOneDelta: number | null;

  /** FSW 67-point selection factor estimate; non-null only when pathway is FSW-family. */
  fswEstimate: FswEstimate | null;

  selectedPathwaySlug: string | null;
  selectedPathwayTitle: string | null;
  selectedPathwayProcessingTime: string | null;
  selectedPathwayDescription: string | null;
  selectedPathwaySteps: EnrichedApplicationStep[];

  profileContext: ProfileContext;

  /** Nationality extracted from voice session JSON when profiles.nationality is null. */
  nationalityVoice: string | null;
  /** Most recent Express Entry draw from immigration_draws table. */
  latestDraw: LatestDraw | null;
  /** Pathway slug from an existing application (null when no application exists yet). */
  applicationPathwaySlug: string | null;
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
