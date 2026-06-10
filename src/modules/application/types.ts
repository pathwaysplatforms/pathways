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
}
