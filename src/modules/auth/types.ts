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
  has_degree: boolean | null;
  degree_level: string | null;
  degree_field: string | null;
  annual_salary_gbp: number | null;
  has_criminal_record: boolean | null;
  english_level: string | null;
  marital_status: string | null;
  has_dependents: boolean | null;
  voice_session_data: Record<string, unknown> | null;
  onboarding_status: "not_started" | "voice_complete" | "complete";
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};
