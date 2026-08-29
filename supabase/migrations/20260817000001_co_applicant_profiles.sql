-- Co-applicant profiles: lets an account owner manage additional immigration
-- profiles (e.g. a spouse, a friend) without those people having their own
-- login. Sign-in stays owner-only — a co-applicant profile never gets an
-- auth_user_id. Every table that was scoped to "the profile owned by the
-- current auth user" is re-scoped to "every profile accessible to the
-- current auth user" (their own profile, plus any co-applicant profiles
-- they own).

-- ── 1. Relax profiles to allow owner-managed rows ──────────────────────────

alter table public.profiles
  alter column auth_user_id drop not null;

alter table public.profiles
  add column owner_profile_id uuid references public.profiles(id) on delete cascade;

alter table public.profiles
  add constraint profiles_owner_xor_auth
  check ((auth_user_id is null) <> (owner_profile_id is null));

-- A co-applicant profile cannot itself own further co-applicants (one level only).
create or replace function public.prevent_nested_co_applicants()
returns trigger
language plpgsql
as $$
begin
  if new.owner_profile_id is not null and exists (
    select 1 from public.profiles
    where id = new.owner_profile_id
      and owner_profile_id is not null
  ) then
    raise exception 'A co-applicant profile cannot itself own co-applicants';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_nested_co_applicants
  before insert or update of owner_profile_id on public.profiles
  for each row
  execute function public.prevent_nested_co_applicants();

-- ── 2. Central helper: every profile id the current auth user may act as ──

create or replace function public.accessible_profile_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid()
  union
  select id from public.profiles
  where owner_profile_id in (
    select id from public.profiles where auth_user_id = auth.uid()
  );
$$;

-- ── 3. profiles RLS: extend select/update to co-applicants, add insert ─────

drop policy "users can read own profile" on public.profiles;
create policy "users can read own and co-applicant profiles"
  on public.profiles
  for select
  to authenticated
  using (id in (select public.accessible_profile_ids()));

drop policy "users can update own profile" on public.profiles;
create policy "users can update own and co-applicant profiles"
  on public.profiles
  for update
  to authenticated
  using (id in (select public.accessible_profile_ids()))
  with check (id in (select public.accessible_profile_ids()));

create policy "users can create co-applicant profiles"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth_user_id is null
    and owner_profile_id in (
      select id from public.profiles where auth_user_id = auth.uid()
    )
  );

-- ── 4. Re-scope every owner-only policy to accessible_profile_ids() ────────

-- applications
drop policy "owner can access own applications" on public.applications;
create policy "owner can access own and co-applicant applications"
  on public.applications
  for all
  to authenticated
  using (profile_id in (select public.accessible_profile_ids()))
  with check (profile_id in (select public.accessible_profile_ids()));

-- application_documents
drop policy "owner can access own application documents" on public.application_documents;
create policy "owner can access own and co-applicant application documents"
  on public.application_documents
  for all
  to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      where a.profile_id in (select public.accessible_profile_ids())
    )
  )
  with check (
    application_id in (
      select a.id from public.applications a
      where a.profile_id in (select public.accessible_profile_ids())
    )
  );

-- application_step_completions
drop policy "owner can access own step completions" on public.application_step_completions;
create policy "owner can access own and co-applicant step completions"
  on public.application_step_completions
  for all
  to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      where a.profile_id in (select public.accessible_profile_ids())
    )
  )
  with check (
    application_id in (
      select a.id from public.applications a
      where a.profile_id in (select public.accessible_profile_ids())
    )
  );

-- voice_sessions
drop policy "owner can access own voice sessions" on public.voice_sessions;
create policy "owner can access own and co-applicant voice sessions"
  on public.voice_sessions
  for all
  to authenticated
  using (profile_id in (select public.accessible_profile_ids()))
  with check (profile_id in (select public.accessible_profile_ids()));

-- audit_log (select only — insert stays trigger/service-role only)
drop policy "owner can read own audit log" on public.audit_log;
create policy "owner can read own and co-applicant audit log"
  on public.audit_log
  for select
  to authenticated
  using (profile_id in (select public.accessible_profile_ids()));

-- pathway_progress
drop policy "users can read own progress" on public.pathway_progress;
create policy "users can read own and co-applicant progress"
  on public.pathway_progress
  for select
  using (profile_id in (select public.accessible_profile_ids()));

drop policy "users can upsert own progress" on public.pathway_progress;
create policy "users can upsert own and co-applicant progress"
  on public.pathway_progress
  for all
  using (profile_id in (select public.accessible_profile_ids()));

-- user_documents
drop policy "users_select_own_documents" on public.user_documents;
create policy "users_select_own_and_co_applicant_documents"
  on public.user_documents
  for select
  to authenticated
  using (user_id in (select public.accessible_profile_ids()));

drop policy "users_insert_own_documents" on public.user_documents;
create policy "users_insert_own_and_co_applicant_documents"
  on public.user_documents
  for insert
  to authenticated
  with check (user_id in (select public.accessible_profile_ids()));

drop policy "users_update_own_documents" on public.user_documents;
create policy "users_update_own_and_co_applicant_documents"
  on public.user_documents
  for update
  to authenticated
  using (user_id in (select public.accessible_profile_ids()));

drop policy "users_delete_own_documents" on public.user_documents;
create policy "users_delete_own_and_co_applicant_documents"
  on public.user_documents
  for delete
  to authenticated
  using (user_id in (select public.accessible_profile_ids()));

-- user_documents storage (path prefix = profiles.id, compared as text)
drop policy "user_documents_storage_select" on storage.objects;
create policy "user_documents_storage_select_co_applicant"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles where id in (select public.accessible_profile_ids())
    )
  );

drop policy "user_documents_storage_insert" on storage.objects;
create policy "user_documents_storage_insert_co_applicant"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles where id in (select public.accessible_profile_ids())
    )
  );

drop policy "user_documents_storage_delete" on storage.objects;
create policy "user_documents_storage_delete_co_applicant"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'user-documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.profiles where id in (select public.accessible_profile_ids())
    )
  );

-- pathway_matches (select only — writes stay service-role only)
drop policy "users_read_own_pathway_matches" on pathway_matches;
create policy "users_read_own_and_co_applicant_pathway_matches"
  on pathway_matches
  for select
  to authenticated
  using (user_id in (select public.accessible_profile_ids()));

-- ── 5. step_checklist_progress: retarget from auth.users to profiles ───────
-- This table was keyed directly to auth.users, bypassing profiles entirely.
-- A co-applicant has no auth.users row, so it can never get checklist
-- progress tracked unless this is retargeted to profiles.id like every
-- other per-person table.

alter table public.step_checklist_progress
  drop constraint step_checklist_progress_user_id_fkey;

update public.step_checklist_progress scp
set user_id = p.id
from public.profiles p
where p.auth_user_id = scp.user_id;

alter table public.step_checklist_progress
  add constraint step_checklist_progress_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

drop policy "users can manage own checklist progress" on public.step_checklist_progress;
create policy "users can manage own and co-applicant checklist progress"
  on public.step_checklist_progress
  for all
  to authenticated
  using (user_id in (select public.accessible_profile_ids()))
  with check (user_id in (select public.accessible_profile_ids()));
