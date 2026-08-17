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
      application_step_completions: {
        Row: {
          application_id: string
          completed_at: string
          id: string
          notes: string | null
          step_id: string
        }
        Insert: {
          application_id: string
          completed_at?: string
          id?: string
          notes?: string | null
          step_id: string
        }
        Update: {
          application_id?: string
          completed_at?: string
          id?: string
          notes?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_step_completions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_step_completions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "pathway_steps"
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
          step_id: string | null
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
          step_id?: string | null
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
          step_id?: string | null
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
          {
            foreignKeyName: "document_requirements_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "pathway_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      ee_pool_snapshots: {
        Row: {
          by_program: Json | null
          crs_distribution: Json | null
          id: string
          scraped_at: string
          snapshot_date: string
          source_url: string | null
          total_candidates: number | null
        }
        Insert: {
          by_program?: Json | null
          crs_distribution?: Json | null
          id?: string
          scraped_at?: string
          snapshot_date: string
          source_url?: string | null
          total_candidates?: number | null
        }
        Update: {
          by_program?: Json | null
          crs_distribution?: Json | null
          id?: string
          scraped_at?: string
          snapshot_date?: string
          source_url?: string | null
          total_candidates?: number | null
        }
        Relationships: []
      }
      guest_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          onboarding_data: Json
          pathway_results: Json | null
          session_token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          onboarding_data?: Json
          pathway_results?: Json | null
          session_token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          onboarding_data?: Json
          pathway_results?: Json | null
          session_token?: string
        }
        Relationships: []
      }
      immigration_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          country: string
          created_at: string
          embedding: string | null
          id: string
          source_id: string
          token_count: number | null
          visa_type: string | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          country: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id: string
          token_count?: number | null
          visa_type?: string | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          country?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source_id?: string
          token_count?: number | null
          visa_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "immigration_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "immigration_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      immigration_draws: {
        Row: {
          country: string
          cutoff_score: number | null
          draw_date: string
          draw_type: string | null
          id: string
          invitations_issued: number | null
          program: string
          raw_data: Json
          round_number: number | null
          scraped_at: string
          source_url: string | null
          tie_breaking_date: string | null
        }
        Insert: {
          country: string
          cutoff_score?: number | null
          draw_date: string
          draw_type?: string | null
          id?: string
          invitations_issued?: number | null
          program: string
          raw_data?: Json
          round_number?: number | null
          scraped_at?: string
          source_url?: string | null
          tie_breaking_date?: string | null
        }
        Update: {
          country?: string
          cutoff_score?: number | null
          draw_date?: string
          draw_type?: string | null
          id?: string
          invitations_issued?: number | null
          program?: string
          raw_data?: Json
          round_number?: number | null
          scraped_at?: string
          source_url?: string | null
          tie_breaking_date?: string | null
        }
        Relationships: []
      }
      immigration_occupation_lists: {
        Row: {
          anzsco_code: string | null
          country: string
          id: string
          noc_code: string | null
          occupation_title: string
          priority_level: string | null
          program: string
          scraped_at: string
          source_url: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          anzsco_code?: string | null
          country: string
          id?: string
          noc_code?: string | null
          occupation_title: string
          priority_level?: string | null
          program: string
          scraped_at?: string
          source_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          anzsco_code?: string | null
          country?: string
          id?: string
          noc_code?: string | null
          occupation_title?: string
          priority_level?: string | null
          program?: string
          scraped_at?: string
          source_url?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      immigration_sources: {
        Row: {
          content_hash: string
          country: string
          id: string
          is_active: boolean
          metadata: Json
          raw_markdown: string
          scraped_at: string
          source_url: string
          title: string | null
          visa_type: string | null
        }
        Insert: {
          content_hash: string
          country: string
          id?: string
          is_active?: boolean
          metadata?: Json
          raw_markdown: string
          scraped_at?: string
          source_url: string
          title?: string | null
          visa_type?: string | null
        }
        Update: {
          content_hash?: string
          country?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          raw_markdown?: string
          scraped_at?: string
          source_url?: string
          title?: string | null
          visa_type?: string | null
        }
        Relationships: []
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
      pathway_documents: {
        Row: {
          chunk_index: number
          chunk_text: string
          country_code: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          pathway_id: string
          pathway_name: string
          pathway_type: string
          source_date: string | null
          source_url: string | null
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          country_code: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          pathway_id: string
          pathway_name: string
          pathway_type: string
          source_date?: string | null
          source_url?: string | null
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          country_code?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          pathway_id?: string
          pathway_name?: string
          pathway_type?: string
          source_date?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      pathway_matches: {
        Row: {
          id: string
          matched_at: string
          profile_snapshot: Json
          summary: string
          top_pathways: Json
          user_id: string
        }
        Insert: {
          id?: string
          matched_at?: string
          profile_snapshot: Json
          summary?: string
          top_pathways: Json
          user_id: string
        }
        Update: {
          id?: string
          matched_at?: string
          profile_snapshot?: Json
          summary?: string
          top_pathways?: Json
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
      pathway_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          pathway_slug: string
          profile_id: string
          status: string
          step_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          pathway_slug: string
          profile_id: string
          status?: string
          step_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          pathway_slug?: string
          profile_id?: string
          status?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathway_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "pathway_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      pathway_steps: {
        Row: {
          checklist_items: Json | null
          description: string
          document_requirement_id: string | null
          estimated_days_max: number | null
          estimated_days_min: number | null
          estimated_duration: string
          fee_cad: number | null
          form_numbers: string[] | null
          id: string
          is_optional: boolean
          last_enriched_at: string | null
          official_url: string | null
          pathway_id: string
          pro_tips: string | null
          resources: Json | null
          step_number: number
          title: string
          type: string
        }
        Insert: {
          checklist_items?: Json | null
          description: string
          document_requirement_id?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          estimated_duration: string
          fee_cad?: number | null
          form_numbers?: string[] | null
          id?: string
          is_optional?: boolean
          last_enriched_at?: string | null
          official_url?: string | null
          pathway_id: string
          pro_tips?: string | null
          resources?: Json | null
          step_number: number
          title: string
          type?: string
        }
        Update: {
          checklist_items?: Json | null
          description?: string
          document_requirement_id?: string | null
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          estimated_duration?: string
          fee_cad?: number | null
          form_numbers?: string[] | null
          id?: string
          is_optional?: boolean
          last_enriched_at?: string | null
          official_url?: string | null
          pathway_id?: string
          pro_tips?: string | null
          resources?: Json | null
          step_number?: number
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathway_steps_document_requirement_id_fkey"
            columns: ["document_requirement_id"]
            isOneToOne: false
            referencedRelation: "document_requirements"
            referencedColumns: ["id"]
          },
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
          program_type: string | null
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
          program_type?: string | null
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
          program_type?: string | null
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
      posts: {
        Row: {
          ai_summary: string | null
          author_id: string | null
          body: string | null
          cover_seed: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string
          source_name: string | null
          source_url: string | null
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          author_id?: string | null
          body?: string | null
          cover_seed?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          author_id?: string | null
          body?: string | null
          cover_seed?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string
          source_name?: string | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          annual_income: number | null
          auth_user_id: string
          avatar_url: string | null
          canadian_education_years: number | null
          canadian_work_recent: boolean | null
          canadian_work_years: number | null
          clb_listening: number | null
          clb_reading: number | null
          clb_speaking: number | null
          clb_writing: number | null
          country_of_residence: string | null
          created_at: string
          current_country: string | null
          date_of_birth: string | null
          degree_field: string | null
          degree_level: string | null
          eca_obtained: boolean | null
          education_level: string | null
          education_level_voice: string | null
          email: string | null
          english_level: string | null
          foreign_work_recent: boolean | null
          foreign_work_years: number | null
          full_name: string | null
          has_canadian_experience: boolean | null
          has_canadian_job_offer: boolean | null
          has_criminal_record: boolean | null
          has_degree: boolean | null
          has_dependents: boolean | null
          has_family_in_canada: boolean | null
          has_provincial_nomination: boolean | null
          has_sibling_in_canada: boolean | null
          has_trade_certificate: boolean | null
          id: string
          income_currency: string | null
          incomplete_fields: string[] | null
          intended_province: string | null
          is_admin: boolean
          language_proficiency_self: string | null
          marital_status: string | null
          nationality: string | null
          nclc_listening: number | null
          nclc_reading: number | null
          nclc_speaking: number | null
          nclc_writing: number | null
          noc_code: string | null
          noc_teer_category: number | null
          occupation: string | null
          onboarding_method: string | null
          onboarding_status: string
          onboarding_step: string | null
          pathway_input_json: Json | null
          phone: string | null
          preferred_language: string
          profile_completeness_pct: number | null
          second_lang_listening: number | null
          second_lang_reading: number | null
          second_lang_speaking: number | null
          second_lang_writing: number | null
          selected_pathway_slug: string | null
          spouse_canadian_work_years: number | null
          spouse_clb_listening: number | null
          spouse_clb_reading: number | null
          spouse_clb_speaking: number | null
          spouse_clb_writing: number | null
          spouse_coming_to_canada: boolean | null
          spouse_education_level: string | null
          subscription_status: string
          updated_at: string
          voice_profile_version: number | null
          voice_session_data: Json | null
          years_experience: number | null
        }
        Insert: {
          annual_income?: number | null
          auth_user_id: string
          avatar_url?: string | null
          canadian_education_years?: number | null
          canadian_work_recent?: boolean | null
          canadian_work_years?: number | null
          clb_listening?: number | null
          clb_reading?: number | null
          clb_speaking?: number | null
          clb_writing?: number | null
          country_of_residence?: string | null
          created_at?: string
          current_country?: string | null
          date_of_birth?: string | null
          degree_field?: string | null
          degree_level?: string | null
          eca_obtained?: boolean | null
          education_level?: string | null
          education_level_voice?: string | null
          email?: string | null
          english_level?: string | null
          foreign_work_recent?: boolean | null
          foreign_work_years?: number | null
          full_name?: string | null
          has_canadian_experience?: boolean | null
          has_canadian_job_offer?: boolean | null
          has_criminal_record?: boolean | null
          has_degree?: boolean | null
          has_dependents?: boolean | null
          has_family_in_canada?: boolean | null
          has_provincial_nomination?: boolean | null
          has_sibling_in_canada?: boolean | null
          has_trade_certificate?: boolean | null
          id?: string
          income_currency?: string | null
          incomplete_fields?: string[] | null
          intended_province?: string | null
          is_admin?: boolean
          language_proficiency_self?: string | null
          marital_status?: string | null
          nationality?: string | null
          nclc_listening?: number | null
          nclc_reading?: number | null
          nclc_speaking?: number | null
          nclc_writing?: number | null
          noc_code?: string | null
          noc_teer_category?: number | null
          occupation?: string | null
          onboarding_method?: string | null
          onboarding_status?: string
          onboarding_step?: string | null
          pathway_input_json?: Json | null
          phone?: string | null
          preferred_language?: string
          profile_completeness_pct?: number | null
          second_lang_listening?: number | null
          second_lang_reading?: number | null
          second_lang_speaking?: number | null
          second_lang_writing?: number | null
          selected_pathway_slug?: string | null
          spouse_canadian_work_years?: number | null
          spouse_clb_listening?: number | null
          spouse_clb_reading?: number | null
          spouse_clb_speaking?: number | null
          spouse_clb_writing?: number | null
          spouse_coming_to_canada?: boolean | null
          spouse_education_level?: string | null
          subscription_status?: string
          updated_at?: string
          voice_profile_version?: number | null
          voice_session_data?: Json | null
          years_experience?: number | null
        }
        Update: {
          annual_income?: number | null
          auth_user_id?: string
          avatar_url?: string | null
          canadian_education_years?: number | null
          canadian_work_recent?: boolean | null
          canadian_work_years?: number | null
          clb_listening?: number | null
          clb_reading?: number | null
          clb_speaking?: number | null
          clb_writing?: number | null
          country_of_residence?: string | null
          created_at?: string
          current_country?: string | null
          date_of_birth?: string | null
          degree_field?: string | null
          degree_level?: string | null
          eca_obtained?: boolean | null
          education_level?: string | null
          education_level_voice?: string | null
          email?: string | null
          english_level?: string | null
          foreign_work_recent?: boolean | null
          foreign_work_years?: number | null
          full_name?: string | null
          has_canadian_experience?: boolean | null
          has_canadian_job_offer?: boolean | null
          has_criminal_record?: boolean | null
          has_degree?: boolean | null
          has_dependents?: boolean | null
          has_family_in_canada?: boolean | null
          has_provincial_nomination?: boolean | null
          has_sibling_in_canada?: boolean | null
          has_trade_certificate?: boolean | null
          id?: string
          income_currency?: string | null
          incomplete_fields?: string[] | null
          intended_province?: string | null
          is_admin?: boolean
          language_proficiency_self?: string | null
          marital_status?: string | null
          nationality?: string | null
          nclc_listening?: number | null
          nclc_reading?: number | null
          nclc_speaking?: number | null
          nclc_writing?: number | null
          noc_code?: string | null
          noc_teer_category?: number | null
          occupation?: string | null
          onboarding_method?: string | null
          onboarding_status?: string
          onboarding_step?: string | null
          pathway_input_json?: Json | null
          phone?: string | null
          preferred_language?: string
          profile_completeness_pct?: number | null
          second_lang_listening?: number | null
          second_lang_reading?: number | null
          second_lang_speaking?: number | null
          second_lang_writing?: number | null
          selected_pathway_slug?: string | null
          spouse_canadian_work_years?: number | null
          spouse_clb_listening?: number | null
          spouse_clb_reading?: number | null
          spouse_clb_speaking?: number | null
          spouse_clb_writing?: number | null
          spouse_coming_to_canada?: boolean | null
          spouse_education_level?: string | null
          subscription_status?: string
          updated_at?: string
          voice_profile_version?: number | null
          voice_session_data?: Json | null
          years_experience?: number | null
        }
        Relationships: []
      }
      step_checklist_progress: {
        Row: {
          checked_items: Json
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_items?: Json
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_items?: Json
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "step_checklist_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "pathway_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          display_name: string | null
          document_type: string | null
          file_name: string
          file_size: number
          id: string
          mime_type: string
          storage_path: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          document_type?: string | null
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          storage_path: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          document_type?: string | null
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      match_immigration_chunks: {
        Args: {
          filter_country?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          country: string
          id: string
          similarity: number
          source_url: string
          visa_type: string
        }[]
      }
      match_pathway_documents: {
        Args: {
          filter_country?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          country_code: string
          id: string
          metadata: Json
          pathway_id: string
          pathway_name: string
          pathway_type: string
          similarity: number
          source_url: string
        }[]
      }
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

