create table public.profiles (
  id                 uuid        primary key default gen_random_uuid(),
  auth_user_id       uuid        not null unique references auth.users(id),
  full_name          text,
  email              text,
  nationality        text,
  current_country    text,
  occupation         text,
  years_experience   int,
  has_degree         boolean,
  degree_level       text,
  degree_field       text,
  annual_salary_gbp  int,
  has_criminal_record boolean,
  english_level      text,
  marital_status     text,
  has_dependents     boolean,
  voice_session_data jsonb,
  onboarding_status  text        not null default 'not_started',
  is_admin           boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Handles both magic link (full_name may be null) and Google OAuth (full_name in raw_user_meta_data)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (auth_user_id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

create policy "users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);
