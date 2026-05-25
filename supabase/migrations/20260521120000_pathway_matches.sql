create table public.pathway_matches (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  result         jsonb       not null,
  crs_score      integer     not null,
  top_pathway_id text,
  calculated_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index pathway_matches_user_id_idx on public.pathway_matches(user_id);

alter table public.pathway_matches enable row level security;

create policy "users can read own pathway matches"
  on public.pathway_matches for select to authenticated
  using (auth.uid() = (select auth_user_id from public.profiles where id = user_id));

create policy "service role can write pathway matches"
  on public.pathway_matches for all
  using (auth.role() = 'service_role');

create trigger set_pathway_matches_updated_at
  before update on public.pathway_matches
  for each row execute function public.set_updated_at();
