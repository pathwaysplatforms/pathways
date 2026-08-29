-- ─── guest_sessions ────────────────────────────────────────────────────────────
-- Stores ephemeral onboarding state for unauthenticated visitors.
-- All reads/writes go through the service-role client in API routes.
-- Expires automatically after 7 days (application-level enforcement).

CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  onboarding_data jsonb NOT NULL DEFAULT '{}',
  pathway_results jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

-- Service-role bypasses RLS; no anon/auth policies needed since we always
-- use the admin client.  A deny-all policy makes the intent explicit.
CREATE POLICY "no_direct_access" ON public.guest_sessions
  AS RESTRICTIVE
  FOR ALL
  USING (false);

-- ─── Index for fast token lookups ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_guest_sessions_token ON public.guest_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires ON public.guest_sessions (expires_at);

-- ─── subscription_status on profiles ───────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text
    NOT NULL
    DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'paid'));

COMMENT ON COLUMN public.profiles.subscription_status IS 'Billing tier: free or paid';
