-- Creates the user-documents Storage bucket on both local and remote.
--
-- config.toml [storage.buckets.user-documents] only runs on `supabase start`,
-- not `supabase db reset`, so the bucket must also be created via migration to
-- exist after a db reset and after a remote db push.
--
-- file_size_limit: 10 MB in bytes (bigint)
-- ON CONFLICT DO NOTHING: safe to re-run; no-op if bucket already exists.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-documents',
  'user-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;
