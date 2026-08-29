# Task: write all database migrations

## Source of truth
Read /specs/database-schema.md completely before writing any SQL.

## What to produce
One migration file per logical group in /supabase/migrations/.
Naming: YYYYMMDD_NNN_description.sql

## Files to create

### 001_extensions.sql
- CREATE EXTENSION IF NOT EXISTS vector
- CREATE EXTENSION IF NOT EXISTS "uuid-ossp"

### 002_reference_tables.sql
- countries table
- pathway_categories table
- RLS policies for both

### 003_pathways.sql
- pathways table with vector(1536) column
- document_requirements table
- pathway_steps table
- ivfflat index on pathways.embedding
- RLS policies for all three

### 004_profiles.sql
- profiles table
- Trigger: auto-create profile row on auth.users insert
  Extract full_name from raw_user_meta_data for Google OAuth signups
- Trigger: auto-update updated_at
- RLS policies

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
- RLS: audit_log SELECT owner only, INSERT service role only,
  no UPDATE or DELETE ever

### 007_seed_reference_data.sql
Seed data (also copy to supabase/seed.sql):
Countries: UK, France, Germany, Canada, Australia, USA,
  Netherlands, Portugal, Spain, Ireland
Categories: Skilled Worker, Family Reunification, Student, Investor
3 sample pathways for UK with all fields populated (no embeddings yet)
Document requirements for each sample pathway

## Note on vector embeddings
The migrations create the pgvector extension and embedding column.
The embedding column will be NULL for all seed data — this is expected.
Actual embedding generation is implemented in the pathway engine session.

## Tests to write
tests/integration/database/rls.test.ts:
- A user cannot read another user's profile
- A user cannot read another user's application
- A user cannot read another user's documents
- audit_log cannot be inserted from anon or user role
- pathways are readable by any authenticated user
- pathways are not mutable by a regular user
- profile is auto-created when a new auth user is inserted

## Definition of done
- supabase db reset completes with zero errors
- All RLS integration tests pass
- supabase gen types typescript --local outputs valid types
- Save generated types to src/types/database.ts
- Open http://127.0.0.1:54323 and verify all tables exist with seed data