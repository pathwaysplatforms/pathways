# Task: write all database migrations

## Source of truth
Read /specs/database-schema.md completely before writing any SQL.

## What to produce
One migration file per logical group in /supabase/migrations/.
Name format: YYYYMMDD_NNNN_description.sql

## Files to create

### 001_extensions.sql
- enable pgvector: CREATE EXTENSION IF NOT EXISTS vector;
- enable uuid: CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

### 002_reference_tables.sql
- countries table
- pathway_categories table
- RLS policies for both

### 003_pathways.sql
- pathways table with vector column
- document_requirements table
- pathway_steps table
- ivfflat index on pathways.embedding
- RLS policies for all three

### 004_profiles.sql
- profiles table
- Trigger: auto-create profile row when auth.users gets a new row
- Trigger: auto-update updated_at
- RLS policies
### Profile auto-create trigger note
The trigger on auth.users insert must handle both magic link signups
(where full_name may be null initially) and Google OAuth signups
(where user_metadata.full_name and user_metadata.avatar_url are available).
Extract these from the NEW.raw_user_meta_data jsonb field in the trigger function.

### 005_applications.sql
- applications table
- application_documents table
- Trigger: auto-update updated_at on applications
- RLS policies using profile ownership check

### 006_voice_and_audit.sql
- voice_sessions table
- audit_log table
- Trigger: insert audit_log row when applications.status changes
- Trigger: insert audit_log row when application_documents.status changes
- RLS: audit_log SELECT owner only, INSERT server-role only, no UPDATE/DELETE

### 007_seed_reference_data.sql
Seed data for development (also create supabase/seed.sql as a copy):
- 10 countries (UK, France, Germany, Canada, Australia, USA, Netherlands, 
  Portugal, Spain, Ireland)
- 4 pathway categories (Skilled Worker, Family Reunification, Student, Investor)
- 3 sample pathways for UK with all fields populated (no embeddings yet)
- Document requirements for each sample pathway

## Tests to write
tests/integration/database/rls.test.ts:
- a user cannot read another user's profile
- a user cannot read another user's application
- a user cannot read another user's documents
- audit_log cannot be inserted from an anon/user role (service role only)
- pathways are readable by any authenticated user
- pathways are not mutable by a regular user

## Definition of done
- All migrations apply cleanly to a fresh local Supabase instance
- `supabase db reset` completes without errors
- All RLS integration tests pass
- supabase gen types typescript outputs valid types saved to src/types/database.ts