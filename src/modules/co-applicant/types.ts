import { z } from 'zod';

export const CreateCoApplicantInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
});

export type CreateCoApplicantInput = z.infer<typeof CreateCoApplicantInputSchema>;

export interface CoApplicantProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  onboarding_status: 'not_started' | 'voice_complete' | 'complete';
}

/** One profile the current auth user may act as — themself or a co-applicant they own. */
export interface AccessibleProfileSummary {
  profileId: string;
  fullName: string | null;
  isOwner: boolean;
}
