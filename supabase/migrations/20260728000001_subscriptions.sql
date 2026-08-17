-- Stores Stripe subscription state synced by the webhook handler.
-- One row per user (upserted on conflict with user_id).

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  stripe_price_id         text,
  -- mirrors Stripe subscription statuses: active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired
  status                  text not null default 'inactive',
  cancel_at_period_end    boolean not null default false,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- One subscription row per user
create unique index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

-- Fast lookup by Stripe customer id (used in webhook handler)
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

-- RLS: users may only read their own row; writes go through the webhook (service role)
alter table public.subscriptions enable row level security;

create policy "Users read own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Keep updated_at current on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
