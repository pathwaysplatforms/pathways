# Database schema

This document describes the Supabase/Postgres schema. **Keep it in sync** with `supabase/migrations/`.

## Conventions

- Use UUID primary keys unless a natural stable key exists.
- `created_at` / `updated_at` timestamps (UTC) on mutable tables.
- Row Level Security (RLS) enabled on user-owned data; policies documented per table.

## Tables

_Document tables, columns, indexes, foreign keys, and RLS policies as migrations are added._

## Enums

_Document custom enum types here._

## Notes

- Regenerate `src/types/database.ts` after schema changes (Supabase CLI or project script).
