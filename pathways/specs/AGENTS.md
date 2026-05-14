# Agent rules

All agents (human or automated) must:

1. Read `specs/` before implementing features that touch the database, voice, pathways, documents, or AI surfaces.
2. Apply schema changes only via `supabase/migrations/` and keep `specs/database-schema.md` aligned with migrations.
3. Prefer small, reviewable changes; match existing patterns in `src/`.
4. Never commit secrets; use `.env.example` for documented variables and keep real values in `.env.local` only.
