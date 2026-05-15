# Pathways — Claude / agent instructions

This is the primary orientation file for the repository.

## Before building

1. Read `specs/AGENTS.md` for rules all agents follow.
2. Read the relevant spec for your area: `database-schema.md`, `voice-module.md`, `pathway-engine.md`, `ai-features.md`.
3. Schema changes belong in `supabase/migrations/`; update `specs/database-schema.md` to match.
4. Regenerate `src/types/database.ts` after migrations when types are available.

## Layout

- `src/app/` — Next.js App Router
- `src/modules/*` — feature modules (auth, voice, pathways, documents, ai)
- `src/lib/supabase/` — database client and typed helpers
- `src/lib/logger.ts` — Pino logger
- `src/lib/errors.ts` — application error types
- `tests/` — unit, integration, e2e

## Environment

Copy `.env.example` to `.env.local` and fill in local values. Never commit secrets.
