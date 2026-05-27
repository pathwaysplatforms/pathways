import { z } from "zod";

export const TurnResponseSchema = z.object({
  message: z.string(),
  delta: z.object({
    full_name: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    current_country: z.string().nullable().optional(),
    marital_status: z.string().nullable().optional(),
    spouse_coming_to_canada: z.boolean().nullable().optional(),
    education_level_voice: z.string().nullable().optional(),
    years_experience: z.number().nullable().optional(),
    has_canadian_experience: z.boolean().nullable().optional(),
    occupation: z.string().nullable().optional(),
    language_proficiency_self: z
      .enum(["native", "fluent", "advanced", "intermediate", "basic"])
      .nullable()
      .optional(),
    has_family_in_canada: z.boolean().nullable().optional(),
    intended_province: z.string().nullable().optional(),
    annual_income: z.number().nullable().optional(),
    income_currency: z.string().nullable().optional(),
  }),
  complete: z.boolean(),
  requires_review: z.array(z.string()),
});

export const VoiceExtractedProfileSchema = z.object({
  full_name: z.string().nullable(),
  date_of_birth: z.string().nullable(),
  nationality: z.string().nullable(),
  current_country: z.string().nullable(),
  marital_status: z.string().nullable(),
  spouse_coming_to_canada: z.boolean().nullable(),
  education_level_voice: z.string().nullable(),
  years_experience: z.number().nullable(),
  has_canadian_experience: z.boolean().nullable(),
  occupation: z.string().nullable(),
  language_proficiency_self: z
    .enum(["native", "fluent", "advanced", "intermediate", "basic"])
    .nullable(),
  has_family_in_canada: z.boolean().nullable(),
  intended_province: z.string().nullable(),
  annual_income: z.number().nullable(),
  income_currency: z.string().nullable(),
  requires_review: z.array(z.string()),
});

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const TurnRequestSchema = z.object({
  sessionId: z.string().uuid(),
  transcript: z.string(),
  history: z.array(MessageSchema),
});

export const SessionRequestSchema = z.object({});

export const ConfirmRequestSchema = z.object({
  updates: VoiceExtractedProfileSchema.omit({ requires_review: true }).partial(),
});

export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type VoiceExtractedProfile = z.infer<typeof VoiceExtractedProfileSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export type PartialExtractedProfile = Partial<VoiceExtractedProfile>;
