create table public.voice_sessions (
  id               uuid        primary key default gen_random_uuid(),
  profile_id       uuid        not null references public.profiles(id),
  transcript       text,
  extracted_data   jsonb,
  duration_seconds int,
  status           text        not null default 'in_progress',
  created_at       timestamptz not null default now()
);

create table public.audit_log (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        references public.profiles(id),
  action       text        not null,
  entity_type  text        not null,
  entity_id    uuid        not null,
  before_state jsonb,
  after_state  jsonb,
  created_at   timestamptz not null default now()
);

alter table public.voice_sessions enable row level security;
alter table public.audit_log       enable row level security;

create policy "owner can access own voice sessions"
  on public.voice_sessions
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

-- SELECT only — INSERT is trigger/service-role only, no UPDATE or DELETE ever
create policy "owner can read own audit log"
  on public.audit_log
  for select
  to authenticated
  using (
    profile_id in (
      select id from public.profiles where auth_user_id = auth.uid()
    )
  );

create or replace function public.log_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_log (
      profile_id, action, entity_type, entity_id, before_state, after_state
    )
    values (
      new.profile_id,
      'application.status_changed',
      'application',
      new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger on_application_status_changed
  after update on public.applications
  for each row
  execute function public.log_application_status_change();

create or replace function public.log_document_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_log (
      profile_id, action, entity_type, entity_id, before_state, after_state
    )
    values (
      (select a.profile_id from public.applications a where a.id = new.application_id),
      'document.status_changed',
      'document',
      new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

create trigger on_application_document_status_changed
  after update on public.application_documents
  for each row
  execute function public.log_document_status_change();
