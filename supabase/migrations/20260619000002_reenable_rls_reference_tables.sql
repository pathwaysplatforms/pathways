-- Re-enable Row Level Security on reference/content tables.
--
-- These tables were created with RLS enabled (20240101000000, 20260515000002,
-- 20260515000003) and their read policies still exist, but the local database had
-- RLS toggled off out-of-band, leaving the policies unenforced. This restores the
-- intended posture. `enable row level security` is idempotent (no error when RLS is
-- already on), so this migration is a harmless no-op on any DB that is already correct.

alter table public.immigration_chunks    enable row level security;
alter table public.pathway_categories    enable row level security;
alter table public.pathways               enable row level security;
alter table public.document_requirements  enable row level security;
alter table public.pathway_steps          enable row level security;
