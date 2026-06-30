import { z } from "zod";
import type { VoiceExtractedProfile } from "@/modules/voice/types";
import type { PathwayMatchResult } from "@/types/pathways";

/** Data collected during guest onboarding — subset of VoiceExtractedProfile. */
export type GuestOnboardingData = Partial<VoiceExtractedProfile>;

/** A guest session row as stored in the database. */
export interface GuestSession {
  id: string;
  session_token: string;
  onboarding_data: GuestOnboardingData;
  pathway_results: PathwayMatchResult | null;
  created_at: string;
  expires_at: string;
}

/** Zod schema for creating a guest session (no user input required). */
export const CreateGuestSessionSchema = z.object({});

/** Zod schema for updating a guest session's onboarding data. */
export const UpdateGuestSessionSchema = z.object({
  onboarding_data: z.record(z.unknown()).optional(), // internal merge shape; API layer uses stricter schema
  pathway_results: z.record(z.unknown()).optional(),
});

export type UpdateGuestSession = z.infer<typeof UpdateGuestSessionSchema>;
