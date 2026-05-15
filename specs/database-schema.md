# Pathways — database schema specification

## Platform: Supabase (PostgreSQL 15 + pgvector)
## Rule: every table has RLS enabled. No exceptions.
## Rule: migrations go in /supabase/migrations/. Never edit dashboard directly.

---

## Table: profiles
Extends Supabase auth.users. Created automatically on signup via trigger.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| auth_user_id | uuid FK → auth.users | unique, not null |
| full_name | text | |
| email | text | |
| nationality | text | ISO country name |
| current_country | text | where they live now |
| occupation | text | free text |
| years_experience | int | |
| has_degree | boolean | |
| degree_level | text | 'bachelor','master','phd','other' |
| degree_field | text | |
| annual_salary_gbp | int | in pence |
| has_criminal_record | boolean | |
| english_level | text | 'native','fluent','b2','b1','below_b1' |
| marital_status | text | |
| has_dependents | boolean | |
| voice_session_data | jsonb | raw extracted data from voice session |
| onboarding_status | text | 'not_started','voice_complete','complete' |
| is_admin | boolean | default false |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | auto-updated via trigger |

RLS:
- SELECT: auth.uid() = auth_user_id
- UPDATE: auth.uid() = auth_user_id
- INSERT: via trigger only

---

## Table: countries
Admin-managed reference data.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | unique |
| iso_code | char(2) | unique |
| region | text | 'Europe','Asia-Pacific', etc |
| is_active | boolean | default true |

RLS: SELECT open to authenticated. Mutations admin only.

---

## Table: pathway_categories
e.g. 'Skilled Worker', 'Family', 'Student', 'Investor'

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | unique |
| slug | text | unique, URL-safe |
| description | text | |

RLS: SELECT open to authenticated. Mutations admin only.

---

## Table: pathways
Curated source of truth. Admin-managed, never AI-generated.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| country_id | uuid FK → countries | |
| category_id | uuid FK → pathway_categories | |
| title | text | display name |
| slug | text | unique, URL-safe |
| official_name | text | legal/government name |
| description | text | plain English |
| processing_time_min | text | e.g. '3 weeks' |
| processing_time_max | text | e.g. '8 weeks' |
| fee_gbp | int | in pence |
| requires_degree | boolean | |
| min_years_experience | int | 0 if none required |
| min_salary_gbp | int | in pence, 0 if none |
| requires_english_test | boolean | |
| english_min_score | text | e.g. 'IELTS 6.5' |
| additional_rules | jsonb | flexible structured rules |
| embedding | vector(1536) | OpenAI text-embedding-3-small |
| is_active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Index: CREATE INDEX ON pathways USING ivfflat (embedding vector_cosine_ops);
RLS: SELECT open to authenticated. Mutations admin only.

---

## Table: document_requirements
Every document needed for a pathway. Admin-curated.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| pathway_id | uuid FK → pathways | |
| name | text | e.g. "Valid passport" |
| description | text | what's acceptable |
| document_type | text | 'passport','bank_statement', etc |
| is_mandatory | boolean | |
| validity_period | text | e.g. '3 months', null if no expiry |
| validation_rules | jsonb | rules for AI verification |
| sort_order | int | display order |

RLS: SELECT open to authenticated. Mutations admin only.

---

## Table: pathway_steps
Ordered steps to complete a pathway. Admin-curated.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| pathway_id | uuid FK → pathways | |
| title | text | |
| description | text | |
| step_number | int | ordering |
| is_optional | boolean | |
| estimated_duration | text | e.g. '1-2 weeks' |

RLS: SELECT open to authenticated. Mutations admin only.

---

## Table: applications

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK → profiles | |
| pathway_id | uuid FK → pathways | |
| status | text | 'draft','in_progress','submitted','approved','rejected' |
| notes | text | user private notes |
| submitted_at | timestamptz | null until submitted |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: owner only via profile_id check.

---

## Table: application_documents

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| application_id | uuid FK → applications | |
| requirement_id | uuid FK → document_requirements | |
| storage_path | text | Supabase Storage path |
| original_filename | text | |
| mime_type | text | |
| file_size_bytes | int | |
| status | text | 'uploaded','ai_reviewing','verified','rejected','needs_resubmission' |
| ai_analysis | jsonb | { valid, issues, extracted_fields } |
| rejection_reason | text | |
| uploaded_at | timestamptz | |
| verified_at | timestamptz | |

RLS: owner only.

---

## Table: voice_sessions

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK → profiles | |
| transcript | text | full conversation |
| extracted_data | jsonb | structured fields extracted |
| duration_seconds | int | |
| status | text | 'in_progress','completed','failed','needs_review' |
| created_at | timestamptz | |

RLS: owner only.

---

## Table: audit_log
Immutable. Append-only.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK → profiles | nullable |
| action | text | e.g. 'application.status_changed' |
| entity_type | text | 'application','document','profile' |
| entity_id | uuid | affected row |
| before_state | jsonb | snapshot before |
| after_state | jsonb | snapshot after |
| created_at | timestamptz | |

RLS: SELECT owner only. INSERT server only. No UPDATE or DELETE ever.

---

## Triggers required
1. Auto-create profile on auth.users insert
   - Extract full_name from raw_user_meta_data if Google OAuth
2. Auto-update updated_at on profiles, pathways, applications
3. Auto-insert audit_log on application status change
4. Auto-insert audit_log on application_documents status change