-- ─────────────────────────────────────────────────────────────────────────────
-- Subscription tier expansion + account profile columns + JWT claims sync
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Update subscription_status to accept the 'guest' tier.
-- The previous constraint from 20260616000001 only allows ('free', 'paid').
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
    CHECK (subscription_status IN ('guest', 'free', 'paid'));

COMMENT ON COLUMN public.profiles.subscription_status IS 'Billing tier: guest (converted guest), free, or paid';

-- Step 2: Add account profile columns.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url           text,
  ADD COLUMN IF NOT EXISTS preferred_language   text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS country_of_residence text;

COMMENT ON COLUMN public.profiles.avatar_url           IS 'User-uploaded avatar URL in Supabase Storage';
COMMENT ON COLUMN public.profiles.preferred_language   IS 'ISO 639-1 language code, defaults to en';
COMMENT ON COLUMN public.profiles.phone                IS 'E.164 phone number, optional';
COMMENT ON COLUMN public.profiles.country_of_residence IS 'Current country of residence (free text)';

-- Step 3: JWT claims sync trigger.
-- Supabase JWTs carry auth.users.raw_app_meta_data as the "app_metadata" claim.
-- This function syncs subscription_status and is_admin into that field so
-- middleware can read them from the session JWT without a database round-trip.
CREATE OR REPLACE FUNCTION public.sync_profile_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'subscription_status', NEW.subscription_status,
      'is_admin',            NEW.is_admin
    )
  WHERE id = NEW.auth_user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_jwt_claims ON public.profiles;
CREATE TRIGGER sync_profile_jwt_claims
  AFTER INSERT OR UPDATE OF subscription_status, is_admin ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_jwt();

-- Step 4: Backfill app_metadata for all existing users.
DO $$
BEGIN
  UPDATE auth.users u
  SET raw_app_meta_data =
    COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'subscription_status', p.subscription_status,
      'is_admin',            p.is_admin
    )
  FROM public.profiles p
  WHERE p.auth_user_id = u.id;
END;
$$;
