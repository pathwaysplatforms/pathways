import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Logger } from 'pino';
import { DatabaseError } from '@/lib/errors';

/** Stripe subscription statuses that map to the `paid` tier. */
export const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/** Subscription row shape returned by the DB. */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Upserts the subscriptions row for a user and syncs profiles.subscription_status.
 * Called from the Stripe webhook handler; uses the service-role admin client.
 */
export async function syncSubscription(
  admin: SupabaseClient,
  userId: string,
  customerId: string,
  subscription: Stripe.Subscription,
  log: Logger,
): Promise<void> {
  log.info({ action: 'stripe.sync.start', userId, status: subscription.status });

  const isActive = ACTIVE_STATUSES.has(subscription.status);
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;

  const { error: subError } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_price_id: priceId,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_start: periodStart,
        current_period_end: periodEnd,
      },
      { onConflict: 'user_id' },
    );

  if (subError) {
    log.error({ action: 'stripe.sync.sub_error', userId, error: subError });
    throw new DatabaseError('Failed to upsert subscription row', { userId });
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({ subscription_status: isActive ? 'paid' : 'free' })
    .eq('auth_user_id', userId);

  if (profileError) {
    log.error({ action: 'stripe.sync.profile_error', userId, error: profileError });
    throw new DatabaseError('Failed to sync profile subscription_status', { userId });
  }

  log.info({ action: 'stripe.sync.done', userId, isActive });
}

/**
 * Fetches the subscription row for a user_id using the admin client.
 * Returns null when no subscription exists.
 */
export async function getSubscriptionForUser(
  admin: SupabaseClient,
  userId: string,
  log: Logger,
): Promise<SubscriptionRow | null> {
  log.info({ action: 'stripe.getSubscription.start', userId });

  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    log.error({ action: 'stripe.getSubscription.error', userId, error });
    throw new DatabaseError('Failed to fetch subscription', { userId });
  }

  log.info({ action: 'stripe.getSubscription.done', userId, found: data !== null });
  return data as SubscriptionRow | null;
}
