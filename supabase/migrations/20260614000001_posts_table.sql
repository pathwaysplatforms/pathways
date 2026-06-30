-- Enable required extensions
create extension if not exists "uuid-ossp";

-- Posts table (covers both blog articles and external resources)
create table public.posts (
  id              uuid default uuid_generate_v4() primary key,
  title           text not null,
  slug            text not null unique,
  excerpt         text,                          -- 1-2 sentence summary shown on cards
  body            text,                          -- Markdown body (null for external resources)
  cover_seed      text,                          -- Seed string for deterministic SVG generation (use slug)
  tags            text[] default '{}',
  type            text not null check (type in ('article', 'resource')),
  status          text not null default 'draft' check (status in ('draft', 'published')),
  source_url      text,                          -- External URL (resources only)
  source_name     text,                          -- e.g. "Government of Canada", "IRCC"
  ai_summary      text,                          -- Claude-generated summary of external content
  author_id       uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  published_at    timestamptz
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on public.posts
  for each row execute function update_updated_at();

-- Row-level security
alter table public.posts enable row level security;

-- Public can read published posts
create policy "Public can read published posts"
  on public.posts for select
  using (status = 'published');

-- Admin users (role = 'admin' in user metadata) can do everything
create policy "Admins have full access"
  on public.posts for all
  using (
    auth.jwt() ->> 'role' = 'admin'
    or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Indexes for performance
create index posts_type_status_idx on public.posts(type, status, published_at desc);
create index posts_slug_idx on public.posts(slug);
create index posts_tags_idx on public.posts using gin(tags);
