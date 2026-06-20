-- Adds a user-editable display name to the document vault.
-- Falls back to file_name in application code when null.

ALTER TABLE public.user_documents ADD COLUMN display_name text;
