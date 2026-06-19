import { z } from "zod";

export const EducationLevelEnum = z.enum([
  "less_than_secondary",
  "secondary",
  "one_year_post_secondary",
  "two_year_post_secondary",
  "bachelors",
  "two_or_more_credentials",
  "masters",
  "phd",
]);

export const ClbScoreSchema = z.number().int().min(0).max(12);
export const NocTeerCategorySchema = z.number().int().min(0).max(5);

export const TurnResponseSchema = z.object({
  message: z.string(),
  delta: z.object({
    full_name: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    current_country: z.string().nullable().optional(),
    marital_status: z.string().nullable().optional(),
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
    // Language CLB scores
    clb_speaking: z.number().int().min(0).max(12).nullable().optional(),
    clb_listening: z.number().int().min(0).max(12).nullable().optional(),
    clb_reading: z.number().int().min(0).max(12).nullable().optional(),
    clb_writing: z.number().int().min(0).max(12).nullable().optional(),
    // Work experience split
    canadian_work_years: z.number().int().min(0).nullable().optional(),
    foreign_work_years: z.number().int().min(0).nullable().optional(),
    canadian_work_recent: z.boolean().nullable().optional(),
    foreign_work_recent: z.boolean().nullable().optional(),
    // Occupation
    noc_teer_category: z.number().int().min(0).max(5).nullable().optional(),
    noc_code: z.string().nullable().optional(),
    // Education structured
    education_level: EducationLevelEnum.nullable().optional(),
    eca_obtained: z.boolean().nullable().optional(),
    // Spouse
    spouse_coming_to_canada: z.boolean().nullable().optional(),
    spouse_education_level: EducationLevelEnum.nullable().optional(),
    spouse_clb_speaking: z.number().int().min(0).max(12).nullable().optional(),
    spouse_clb_listening: z.number().int().min(0).max(12).nullable().optional(),
    spouse_clb_reading: z.number().int().min(0).max(12).nullable().optional(),
    spouse_clb_writing: z.number().int().min(0).max(12).nullable().optional(),
    spouse_canadian_work_years: z.number().int().min(0).nullable().optional(),
    // CRS bonus factors
    has_provincial_nomination: z.boolean().nullable().optional(),
    has_canadian_job_offer: z.boolean().nullable().optional(),
    has_sibling_in_canada: z.boolean().nullable().optional(),
    // Additional pathway fields
    destination_country: z.string().nullable().optional(),
    purpose: z.string().nullable().optional(),
    dependents: z.number().int().min(0).nullable().optional(),
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
  // Language CLB scores
  clb_speaking: z.number().int().min(0).max(12).nullable().optional(),
  clb_listening: z.number().int().min(0).max(12).nullable().optional(),
  clb_reading: z.number().int().min(0).max(12).nullable().optional(),
  clb_writing: z.number().int().min(0).max(12).nullable().optional(),
  // Work experience split
  canadian_work_years: z.number().int().min(0).nullable().optional(),
  foreign_work_years: z.number().int().min(0).nullable().optional(),
  canadian_work_recent: z.boolean().nullable().optional(),
  foreign_work_recent: z.boolean().nullable().optional(),
  // Occupation
  noc_teer_category: z.number().int().min(0).max(5).nullable().optional(),
  noc_code: z.string().nullable().optional(),
  // Education structured
  education_level: EducationLevelEnum.nullable().optional(),
  eca_obtained: z.boolean().nullable().optional(),
  // Spouse
  spouse_coming_to_canada: z.boolean().nullable().optional(),
  spouse_education_level: EducationLevelEnum.nullable().optional(),
  spouse_clb_speaking: z.number().int().min(0).max(12).nullable().optional(),
  spouse_clb_listening: z.number().int().min(0).max(12).nullable().optional(),
  spouse_clb_reading: z.number().int().min(0).max(12).nullable().optional(),
  spouse_clb_writing: z.number().int().min(0).max(12).nullable().optional(),
  spouse_canadian_work_years: z.number().int().min(0).nullable().optional(),
  // CRS bonus factors
  has_provincial_nomination: z.boolean().nullable().optional(),
  has_canadian_job_offer: z.boolean().nullable().optional(),
  has_sibling_in_canada: z.boolean().nullable().optional(),
  // Additional pathway fields
  destination_country: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  dependents: z.number().int().min(0).nullable().optional(),
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
