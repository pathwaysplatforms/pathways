create table public.applications (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.profiles(id),
  pathway_id   uuid        not null references public.pathways(id),
  status       text        not null default 'draft',
  notes        text,
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger set_applications_updated_at
  before update on public.applications
  for each row
  execute function public.set_updated_at();

create table public.application_documents (
  id                uuid        primary key default gen_random_uuid(),
  application_id    uuid        not null references public.applications(id),
  requirement_id    uuid        not null references public.document_requirements(id),
  storage_path      text        not null,
  original_filename text        not null,
  mime_type         text        not null,
  file_size_bytes   int         not null,
  status            text        not null default 'uploaded',
  ai_analysis       jsonb,
  rejection_reason  text,
  uploaded_at       timestamptz not null default now(),
  verified_at       timestamptz
);

alter table public.applications         enable row level security;
alter table public.application_documents enable row level security;

create policy "owner can access own applications"
  on public.applications
  for all
  to authenticated
  using (
    profile_id in (
      select id from public.profiles where auth_user_id = auth.uid()
    )
  )
  with check (
    profile_id in (
      select id from public.profiles where auth_user_id = auth.uid()
    )
  );

create policy "owner can access own application documents"
  on public.application_documents
  for all
  to authenticated
  using (
    application_id in (
      select a.id
      from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  )
  with check (
    application_id in (
      select a.id
      from public.applications a
      join public.profiles p on p.id = a.profile_id
      where p.auth_user_id = auth.uid()
    )
  );
