-- Tracks which pathway steps a user has completed within an application.
-- One row per completed step. No row = not yet complete.

create table public.application_step_completions (
  id               uuid        primary key default gen_random_uuid(),
  application_id   uuid        not null references public.applications(id) on delete cascade,
  step_id          uuid        not null references public.pathway_steps(id),
  completed_at     timestamptz not null default now(),
  notes            text,
  unique (application_id, step_id)
);

alter table public.application_step_completions enable row level security;

create policy "owner can access own step completions"
  on public.application_step_completions
  for all
  to authenticated
  using (
    application_id in (
      select a.id from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    application_id in (
      select a.id from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  );

-- Add document_requirement_id to pathway_steps so each upload step
-- knows exactly which document it needs
alter table public.pathway_steps
  add column if not exists document_requirement_id uuid
  references public.document_requirements(id);
