import type { EnrichedApplicationStep } from '@/modules/dashboard/types';

export interface ApplicationPageData {
  pathwaySlug: string;
  pathwayTitle: string;
  pathwayOfficialName: string | null;
  pathwayDescription: string | null;
  processingTime: string;
  feesDisplay: string | null;
  steps: EnrichedApplicationStep[];
  totalSteps: number;
  documents: ApplicationDocument[];
}

export interface ApplicationDocument {
  id: string;
  name: string;
  isMandatory: boolean;
  stepId: string | null;
  documentType: string | null;
  /** True when the user has a vault file with a matching document_type. */
  satisfied: boolean;
}

/** Summary of one of the user's applications, for the applications-home list. */
export interface UserApplicationSummary {
  applicationId: string;
  pathwaySlug: string;
  pathwayTitle: string;
  pathwayOfficialName: string | null;
  processingTime: string;
  status: string;
  completedSteps: number;
  totalSteps: number;
}
