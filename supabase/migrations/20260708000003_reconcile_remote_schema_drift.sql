-- ─────────────────────────────────────────────────────────────────────────────
-- Reconcile remote schema drift.
--
-- The remote database had diverged from the repo: several migrations were absent
-- from its history and, in a few cases, their objects were genuinely missing
-- (guest_sessions, application_step_completions, profiles.subscription_status +
-- account columns, pathway_steps.document_requirement_id, the JWT-sync trigger).
-- This migration re-declares those objects idempotently so the remote matches
-- the repo's intended schema.
--
-- It is purely additive DDL plus the app_metadata backfill the JWT-sync feature
-- requires. It intentionally does NOT replay the reference-content data updates
-- from 20260528000001/2/5 — those were superseded by later applied migrations
-- (deduplicate_canadian_pathways / backfill_canadian_pathway_step_types), and
-- replaying them against the current slugs/steps could corrupt content.
--
-- On a fresh `supabase db reset` the original migrations create these objects
-- first and this migration is a harmless no-op.
-- ─────────────────────────────────────────────────────────────────────────────

-- application_step_completions (repo 20260528000004)
create table if not exists public.application_step_completions (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  step_id        uuid not null references public.pathway_steps(id),
  completed_at   timestamptz not null default now(),
  notes          text,
  unique (application_id, step_id)
);
alter table public.application_step_completions enable row level security;
drop policy if exists "owner can access own step completions" on public.application_step_completions;
create policy "owner can access own step completions"
  on public.application_step_completions for all to authenticated
  using (application_id in (
    select a.id from public.applications a join public.profiles p on p.id=a.profile_id
    where p.auth_user_id = auth.uid()))
  with check (application_id in (
    select a.id from public.applications a join public.profiles p on p.id=a.profile_id
    where p.auth_user_id = auth.uid()));

alter table public.pathway_steps
  add column if not exists document_requirement_id uuid references public.document_requirements(id);

-- guest_sessions (repo 20260616000001)
create table if not exists public.guest_sessions (
  id              uuid primary key default gen_random_uuid(),
  session_token   uuid not null unique default gen_random_uuid(),
  onboarding_data jsonb not null default '{}',
  pathway_results jsonb,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default (now() + interval '7 days')
);
alter table public.guest_sessions enable row level security;
drop policy if exists "no_direct_access" on public.guest_sessions;
create policy "no_direct_access" on public.guest_sessions as restrictive for all using (false);
create index if not exists idx_guest_sessions_token   on public.guest_sessions (session_token);
create index if not exists idx_guest_sessions_expires on public.guest_sessions (expires_at);

-- profiles.subscription_status + account columns (repo 20260616000001 + 20260617000001)
alter table public.profiles add column if not exists subscription_status text not null default 'free';
alter table public.profiles drop constraint if exists profiles_subscription_status_check;
alter table public.profiles add constraint profiles_subscription_status_check
  check (subscription_status in ('guest','free','paid'));
alter table public.profiles add column if not exists avatar_url           text;
alter table public.profiles add column if not exists preferred_language   text not null default 'en';
alter table public.profiles add column if not exists phone                text;
alter table public.profiles add column if not exists country_of_residence text;

-- JWT app_metadata sync (repo 20260617000001). raw_app_meta_data is server-only,
-- so it is safe for authorization (unlike user_metadata).
create or replace function public.sync_profile_to_jwt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'subscription_status', new.subscription_status,
    'is_admin',            new.is_admin)
  where id = new.auth_user_id;
  return new;
end;
$$;

drop trigger if exists sync_profile_jwt_claims on public.profiles;
create trigger sync_profile_jwt_claims
  after insert or update of subscription_status, is_admin on public.profiles
  for each row execute function public.sync_profile_to_jwt();

-- Backfill app_metadata for existing users (additive key-merge).
do $$
begin
  update auth.users u
  set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'subscription_status', p.subscription_status,
    'is_admin',            p.is_admin)
  from public.profiles p
  where p.auth_user_id = u.id;
end;
$$;
