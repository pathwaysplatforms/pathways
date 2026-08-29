-- user_documents: general-purpose file vault.
--
-- Each row tracks one file the user has uploaded to the 'user-documents' Storage bucket.
-- document_type is nullable; when set to a value from document_requirements.document_type,
-- the vault entry auto-satisfies the matching requirement across all pathways.
--
-- Constraints enforced in application code (not schema):
--   - Max 20 files per user
--   - Allowed MIME types: application/pdf, image/jpeg, image/png
--   - Max 10 MB per file
--
-- Storage bucket config lives in supabase/config.toml [storage.buckets.user-documents].
-- Storage RLS policies are in this file alongside table policies for a single source of truth.

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE public.user_documents (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path  text          NOT NULL UNIQUE,
  file_name     text          NOT NULL,
  file_size     integer       NOT NULL,
  mime_type     text          NOT NULL,
  document_type text,
  uploaded_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX user_documents_user_idx
  ON public.user_documents (user_id);

CREATE INDEX user_documents_type_idx
  ON public.user_documents (user_id, document_type);

-- ── Table RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own_documents"
  ON public.user_documents FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "users_insert_own_documents"
  ON public.user_documents FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "users_update_own_documents"
  ON public.user_documents FOR UPDATE TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

CREATE POLICY "users_delete_own_documents"
  ON public.user_documents FOR DELETE TO authenticated
  USING (user_id = (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1));

-- ── Storage RLS ───────────────────────────────────────────────────────────────
-- Path pattern: {profiles.id}/{uuid}-{filename}
-- The first path segment must match the requesting user's profile id.
-- Admin client operations (server-side uploads, signed URLs) bypass these policies.

CREATE POLICY "user_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "user_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "user_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-documents'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM public.profiles WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );
