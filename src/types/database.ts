export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      application_documents: {
        Row: {
          ai_analysis: Json | null
          application_id: string
          file_size_bytes: number
          id: string
          mime_type: string
          original_filename: string
          rejection_reason: string | null
          requirement_id: string
          status: string
          storage_path: string
          uploaded_at: string
          verified_at: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          application_id: string
          file_size_bytes: number
          id?: string
          mime_type: string
          original_filename: string
          rejection_reason?: string | null
          requirement_id: string
          status?: string
          storage_path: string
          uploaded_at?: string
          verified_at?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          application_id?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          original_filename?: string
          rejection_reason?: string | null
          requirement_id?: string
          status?: string
          storage_path?: string
          uploaded_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "document_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          pathway_id: string
          profile_id: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          pathway_id: string
          profile_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          pathway_id?: string
          profile_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "pathways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          profile_id: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          profile_id?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          id: string
          is_active: boolean
          iso_code: string
          name: string
          region: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          iso_code: string
          name: string
          region: string
        }
        Update: {
          id?: string
          is_active?: boolean
          iso_code?: string
          name?: string
          region?: string
        }
        Relationships: []
      }
      document_requirements: {
        Row: {
          description: string
          document_type: string
          id: string
          is_mandatory: boolean
          name: string
          pathway_id: string
          sort_order: number
          validation_rules: Json | null
          validity_period: string | null
        }
        Insert: {
          description: string
          document_type: string
          id?: string
          is_mandatory?: boolean
          name: string
          pathway_id: string
          sort_order?: number
          validation_rules?: Json | null
          validity_period?: string | null
        }
        Update: {
          description?: string
          document_type?: string
          id?: string
          is_mandatory?: boolean
          name?: string
          pathway_id?: string
          sort_order?: number
          validation_rules?: Json | null
          validity_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      pathway_categories: {
        Row: {
          description: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          description: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          description?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      pathway_matches: {
        Row: {
          calculated_at: string
          created_at: string
          crs_score: number
          id: string
          result: Json
          top_pathway_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          crs_score: number
          id?: string
          result: Json
          top_pathway_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calculated_at?: string
          created_at?: string
          crs_score?: number
          id?: string
          result?: Json
          top_pathway_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pathway_steps: {
        Row: {
          description: string
          estimated_duration: string
          id: string
          is_optional: boolean
          pathway_id: string
          step_number: number
          title: string
        }
        Insert: {
          description: string
          estimated_duration: string
          id?: string
          is_optional?: boolean
          pathway_id: string
          step_number: number
          title: string
        }
        Update: {
          description?: string
          estimated_duration?: string
          id?: string
          is_optional?: boolean
          pathway_id?: string
          step_number?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_steps_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      pathways: {
        Row: {
          additional_rules: Json | null
          category_id: string
          country_id: string
          created_at: string
          description: string
          embedding: string | null
          english_min_score: string | null
          fee_gbp: number
          id: string
          is_active: boolean
          min_salary_gbp: number
          min_years_experience: number
          official_name: string
          processing_time_max: string
          processing_time_min: string
          requires_degree: boolean
          requires_english_test: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          additional_rules?: Json | null
          category_id: string
          country_id: string
          created_at?: string
          description: string
          embedding?: string | null
          english_min_score?: string | null
          fee_gbp: number
          id?: string
          is_active?: boolean
          min_salary_gbp?: number
          min_years_experience?: number
          official_name: string
          processing_time_max: string
          processing_time_min: string
          requires_degree?: boolean
          requires_english_test?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          additional_rules?: Json | null
          category_id?: string
          country_id?: string
          created_at?: string
          description?: string
          embedding?: string | null
          english_min_score?: string | null
          fee_gbp?: number
          id?: string
          is_active?: boolean
          min_salary_gbp?: number
          min_years_experience?: number
          official_name?: string
          processing_time_max?: string
          processing_time_min?: string
          requires_degree?: boolean
          requires_english_test?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathways_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pathway_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathways_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          annual_salary_gbp: number | null
          auth_user_id: string
          canadian_education_years: number | null
          canadian_work_years: number | null
          clb_listening: number | null
          clb_reading: number | null
          clb_speaking: number | null
          clb_writing: number | null
          created_at: string
          current_country: string | null
          degree_field: string | null
          degree_level: string | null
          eca_obtained: boolean | null
          education_level: string | null
          email: string | null
          english_level: string | null
          foreign_work_years: number | null
          full_name: string | null
          has_canadian_job_offer: boolean | null
          has_criminal_record: boolean | null
          has_degree: boolean | null
          has_dependents: boolean | null
          has_provincial_nomination: boolean | null
          has_sibling_in_canada: boolean | null
          has_trade_certificate: boolean | null
          id: string
          incomplete_fields: string[] | null
          is_admin: boolean
          marital_status: string | null
          nationality: string | null
          nclc_listening: number | null
          nclc_reading: number | null
          nclc_speaking: number | null
          nclc_writing: number | null
          noc_teer_category: number | null
          occupation: string | null
          onboarding_status: string
          profile_completeness_pct: number | null
          second_lang_listening: number | null
          second_lang_reading: number | null
          second_lang_speaking: number | null
          second_lang_writing: number | null
          spouse_canadian_work_years: number | null
          spouse_clb_listening: number | null
          spouse_clb_reading: number | null
          spouse_clb_speaking: number | null
          spouse_clb_writing: number | null
          spouse_coming_to_canada: boolean | null
          spouse_education_level: string | null
          updated_at: string
          voice_profile_version: number | null
          voice_session_data: Json | null
          years_experience: number | null
        }
        Insert: {
          annual_salary_gbp?: number | null
          auth_user_id: string
          canadian_education_years?: number | null
          canadian_work_years?: number | null
          clb_listening?: number | null
          clb_reading?: number | null
          clb_speaking?: number | null
          clb_writing?: number | null
          created_at?: string
          current_country?: string | null
          degree_field?: string | null
          degree_level?: string | null
          eca_obtained?: boolean | null
          education_level?: string | null
          email?: string | null
          english_level?: string | null
          foreign_work_years?: number | null
          full_name?: string | null
          has_canadian_job_offer?: boolean | null
          has_criminal_record?: boolean | null
          has_degree?: boolean | null
          has_dependents?: boolean | null
          has_provincial_nomination?: boolean | null
          has_sibling_in_canada?: boolean | null
          has_trade_certificate?: boolean | null
          id?: string
          incomplete_fields?: string[] | null
          is_admin?: boolean
          marital_status?: string | null
          nationality?: string | null
          nclc_listening?: number | null
          nclc_reading?: number | null
          nclc_speaking?: number | null
          nclc_writing?: number | null
          noc_teer_category?: number | null
          occupation?: string | null
          onboarding_status?: string
          profile_completeness_pct?: number | null
          second_lang_listening?: number | null
          second_lang_reading?: number | null
          second_lang_speaking?: number | null
          second_lang_writing?: number | null
          spouse_canadian_work_years?: number | null
          spouse_clb_listening?: number | null
          spouse_clb_reading?: number | null
          spouse_clb_speaking?: number | null
          spouse_clb_writing?: number | null
          spouse_coming_to_canada?: boolean | null
          spouse_education_level?: string | null
          updated_at?: string
          voice_profile_version?: number | null
          voice_session_data?: Json | null
          years_experience?: number | null
        }
        Update: {
          annual_salary_gbp?: number | null
          auth_user_id?: string
          canadian_education_years?: number | null
          canadian_work_years?: number | null
          clb_listening?: number | null
          clb_reading?: number | null
          clb_speaking?: number | null
          clb_writing?: number | null
          created_at?: string
          current_country?: string | null
          degree_field?: string | null
          degree_level?: string | null
          eca_obtained?: boolean | null
          education_level?: string | null
          email?: string | null
          english_level?: string | null
          foreign_work_years?: number | null
          full_name?: string | null
          has_canadian_job_offer?: boolean | null
          has_criminal_record?: boolean | null
          has_degree?: boolean | null
          has_dependents?: boolean | null
          has_provincial_nomination?: boolean | null
          has_sibling_in_canada?: boolean | null
          has_trade_certificate?: boolean | null
          id?: string
          incomplete_fields?: string[] | null
          is_admin?: boolean
          marital_status?: string | null
          nationality?: string | null
          nclc_listening?: number | null
          nclc_reading?: number | null
          nclc_speaking?: number | null
          nclc_writing?: number | null
          noc_teer_category?: number | null
          occupation?: string | null
          onboarding_status?: string
          profile_completeness_pct?: number | null
          second_lang_listening?: number | null
          second_lang_reading?: number | null
          second_lang_speaking?: number | null
          second_lang_writing?: number | null
          spouse_canadian_work_years?: number | null
          spouse_clb_listening?: number | null
          spouse_clb_reading?: number | null
          spouse_clb_speaking?: number | null
          spouse_clb_writing?: number | null
          spouse_coming_to_canada?: boolean | null
          spouse_education_level?: string | null
          updated_at?: string
          voice_profile_version?: number | null
          voice_session_data?: Json | null
          years_experience?: number | null
        }
        Relationships: []
      }
      voice_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          extracted_data: Json | null
          id: string
          profile_id: string
          status: string
          transcript: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          extracted_data?: Json | null
          id?: string
          profile_id: string
          status?: string
          transcript?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          extracted_data?: Json | null
          id?: string
          profile_id?: string
          status?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

