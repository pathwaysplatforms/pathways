import type { Session, User } from "@supabase/supabase-js";
import type { AuthError } from "@/lib/errors";

export type { Session, User, AuthError };

export type Profile = {
  id: string;
  auth_user_id: string;
  full_name: string | null;
  email: string | null;
  nationality: string | null;
  current_country: string | null;
  occupation: string | null;
  years_experience: number | null;
  marital_status: string | null;
  voice_session_data: Record<string, unknown> | null;
  onboarding_status: "not_started" | "voice_complete" | "complete";
  is_admin: boolean;
  created_at: string;
  updated_at: string;

  // Added by 20260527000001_preflow_redesign migration
  date_of_birth: string | null;
  annual_income: number | null;
  income_currency: string | null;
  intended_province: string | null;
  has_canadian_experience: boolean | null;
  language_proficiency_self: "native" | "fluent" | "advanced" | "intermediate" | "basic" | null;
  has_family_in_canada: boolean | null;
  education_level_voice: string | null;
  spouse_coming_to_canada: boolean | null;
  pathway_input_json: Record<string, unknown> | null;
  onboarding_step: "not_started" | "voice_in_progress" | "voice_complete" | "review" | "complete" | null;
  onboarding_method: "voice" | "chat" | "form" | null;
  selected_pathway_slug: string | null;
};
