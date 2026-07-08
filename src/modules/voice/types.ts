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
    full_name: z.string().max(300).nullable().optional(),
    date_of_birth: z.string().max(300).nullable().optional(),
    nationality: z.string().max(300).nullable().optional(),
    current_country: z.string().max(300).nullable().optional(),
    marital_status: z.string().max(300).nullable().optional(),
    education_level_voice: z.string().max(300).nullable().optional(),
    years_experience: z.number().nullable().optional(),
    has_canadian_experience: z.boolean().nullable().optional(),
    occupation: z.string().max(300).nullable().optional(),
    language_proficiency_self: z
      .enum(["native", "fluent", "advanced", "intermediate", "basic"])
      .nullable()
      .optional(),
    has_family_in_canada: z.boolean().nullable().optional(),
    intended_province: z.string().max(300).nullable().optional(),
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
    noc_code: z.string().max(300).nullable().optional(),
    // Education structured
    education_level: EducationLevelEnum.nullable().optional(),
    eca_obtained: z.boolean().nullable().optional(),
    // Spouse (only the coming flag — sub-fields deferred to profile page)
    spouse_coming_to_canada: z.boolean().nullable().optional(),
    // CRS bonus factors
    has_provincial_nomination: z.boolean().nullable().optional(),
    has_canadian_job_offer: z.boolean().nullable().optional(),
    // Additional pathway fields
    destination_country: z.string().max(300).nullable().optional(),
    purpose: z.string().max(300).nullable().optional(),
    dependents: z.number().int().min(0).nullable().optional(),
  }),
  complete: z.boolean(),
  requires_review: z.array(z.string()),
});

export const VoiceExtractedProfileSchema = z.object({
  full_name: z.string().max(300).nullable(),
  date_of_birth: z.string().max(300).nullable(),
  nationality: z.string().max(300).nullable(),
  current_country: z.string().max(300).nullable(),
  marital_status: z.string().max(300).nullable(),
  education_level_voice: z.string().max(300).nullable(),
  years_experience: z.number().nullable(),
  has_canadian_experience: z.boolean().nullable(),
  occupation: z.string().max(300).nullable(),
  language_proficiency_self: z
    .enum(["native", "fluent", "advanced", "intermediate", "basic"])
    .nullable(),
  has_family_in_canada: z.boolean().nullable(),
  intended_province: z.string().max(300).nullable(),
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
  noc_code: z.string().max(300).nullable().optional(),
  // Education structured
  education_level: EducationLevelEnum.nullable().optional(),
  eca_obtained: z.boolean().nullable().optional(),
  // Spouse — voice collects the flag only; sub-fields are DB-only (set via profile page)
  spouse_coming_to_canada: z.boolean().nullable().optional(),
  spouse_education_level: EducationLevelEnum.nullable().optional(),
  spouse_clb_speaking: z.number().int().min(0).max(12).nullable().optional(),
  spouse_clb_listening: z.number().int().min(0).max(12).nullable().optional(),
  spouse_clb_reading: z.number().int().min(0).max(12).nullable().optional(),
  spouse_clb_writing: z.number().int().min(0).max(12).nullable().optional(),
  spouse_canadian_work_years: z.number().int().min(0).nullable().optional(),
  // CRS bonus factors — voice collects has_provincial_nomination and has_canadian_job_offer only
  has_provincial_nomination: z.boolean().nullable().optional(),
  has_canadian_job_offer: z.boolean().nullable().optional(),
  // DB-only fields — not collected by voice, carried here for CRS/embeddings/matching compatibility
  has_sibling_in_canada: z.boolean().nullable().optional(),
  annual_income: z.number().nullable().optional(),
  income_currency: z.string().max(300).nullable().optional(),
  // Additional pathway fields
  destination_country: z.string().max(300).nullable().optional(),
  purpose: z.string().max(300).nullable().optional(),
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

export const EDUCATION_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'less_than_secondary', label: 'Less than secondary' },
  { value: 'secondary', label: 'Secondary (high school)' },
  { value: 'one_year_post_secondary', label: '1-year post-secondary' },
  { value: 'two_year_post_secondary', label: '2-year post-secondary' },
  { value: 'bachelors', label: "Bachelor's degree" },
  { value: 'two_or_more_credentials', label: 'Two or more credentials' },
  { value: 'masters', label: "Master's degree" },
  { value: 'phd', label: 'Doctorate (PhD)' },
] as const;

export const NOC_TEER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: '0', label: 'TEER 0 — Management' },
  { value: '1', label: 'TEER 1 — University degree' },
  { value: '2', label: 'TEER 2 — College / 2+ yr apprenticeship' },
  { value: '3', label: 'TEER 3 — College / under-2-yr apprenticeship' },
  { value: '4', label: 'TEER 4 — High school diploma' },
  { value: '5', label: 'TEER 5 — Short-term training' },
] as const;

export const BOOLEAN_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const;

export type ConfirmRequest = z.infer<typeof ConfirmRequestSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type VoiceExtractedProfile = z.infer<typeof VoiceExtractedProfileSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export type PartialExtractedProfile = Partial<VoiceExtractedProfile>;
