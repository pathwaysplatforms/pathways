import { z } from "zod";

export const TurnResponseSchema = z.object({
  message: z.string(),
  delta: z.object({
    full_name: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    current_country: z.string().nullable().optional(),
    occupation: z.string().nullable().optional(),
    years_experience: z.number().nullable().optional(),
    has_degree: z.boolean().nullable().optional(),
    degree_level: z.enum(["bachelor", "master", "phd", "other"]).nullable().optional(),
    degree_field: z.string().nullable().optional(),
    annual_salary_gbp: z.number().nullable().optional(),
    has_criminal_record: z.boolean().nullable().optional(),
    english_level: z
      .enum(["native", "fluent", "b2", "b1", "below_b1"])
      .nullable()
      .optional(),
    marital_status: z.string().nullable().optional(),
    has_dependents: z.boolean().nullable().optional(),
  }),
  complete: z.boolean(),
  requires_review: z.array(z.string()),
});

export const VoiceExtractedProfileSchema = z.object({
  full_name: z.string().nullable(),
  nationality: z.string().nullable(),
  current_country: z.string().nullable(),
  occupation: z.string().nullable(),
  years_experience: z.number().nullable(),
  has_degree: z.boolean().nullable(),
  degree_level: z.enum(["bachelor", "master", "phd", "other"]).nullable(),
  degree_field: z.string().nullable(),
  annual_salary_gbp: z.number().nullable(),
  has_criminal_record: z.boolean().nullable(),
  english_level: z.enum(["native", "fluent", "b2", "b1", "below_b1"]).nullable(),
  marital_status: z.string().nullable(),
  has_dependents: z.boolean().nullable(),
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
