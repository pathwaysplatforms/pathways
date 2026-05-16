create table public.countries (
  id         uuid    primary key default gen_random_uuid(),
  name       text    not null unique,
  iso_code   char(2) not null unique,
  region     text    not null,
  is_active  boolean not null default true
);

create table public.pathway_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text not null
);

alter table public.countries          enable row level security;
alter table public.pathway_categories enable row level security;

create policy "authenticated users can read countries"
  on public.countries
  for select
  to authenticated
  using (true);

create policy "authenticated users can read pathway categories"
  on public.pathway_categories
  for select
  to authenticated
  using (true);
