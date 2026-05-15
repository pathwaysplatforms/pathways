-- Reusable trigger function: keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.pathways (
  id                    uuid          primary key default gen_random_uuid(),
  country_id            uuid          not null references public.countries(id),
  category_id           uuid          not null references public.pathway_categories(id),
  title                 text          not null,
  slug                  text          not null unique,
  official_name         text          not null,
  description           text          not null,
  processing_time_min   text          not null,
  processing_time_max   text          not null,
  fee_gbp               int           not null,
  requires_degree       boolean       not null default false,
  min_years_experience  int           not null default 0,
  min_salary_gbp        int           not null default 0,
  requires_english_test boolean       not null default false,
  english_min_score     text,
  additional_rules      jsonb,
  embedding             vector(1536),
  is_active             boolean       not null default true,
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

create index on public.pathways using ivfflat (embedding vector_cosine_ops);

create trigger set_pathways_updated_at
  before update on public.pathways
  for each row
  execute function public.set_updated_at();

create table public.document_requirements (
  id               uuid  primary key default gen_random_uuid(),
  pathway_id       uuid  not null references public.pathways(id),
  name             text  not null,
  description      text  not null,
  document_type    text  not null,
  is_mandatory     boolean not null default true,
  validity_period  text,
  validation_rules jsonb,
  sort_order       int   not null default 0
);

create table public.pathway_steps (
  id                 uuid  primary key default gen_random_uuid(),
  pathway_id         uuid  not null references public.pathways(id),
  title              text  not null,
  description        text  not null,
  step_number        int   not null,
  is_optional        boolean not null default false,
  estimated_duration text  not null
);

alter table public.pathways             enable row level security;
alter table public.document_requirements enable row level security;
alter table public.pathway_steps        enable row level security;

create policy "authenticated users can read pathways"
  on public.pathways
  for select
  to authenticated
  using (true);

create policy "authenticated users can read document requirements"
  on public.document_requirements
  for select
  to authenticated
  using (true);

create policy "authenticated users can read pathway steps"
  on public.pathway_steps
  for select
  to authenticated
  using (true);
