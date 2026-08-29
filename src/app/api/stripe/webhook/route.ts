/**
 * POST /api/stripe/webhook
 * Verifies the Stripe signature and syncs subscription state into Supabase.
 * Handles: checkout.session.completed, customer.subscription.updated/deleted
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { createRequestLogger } from '@/lib/logger';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { syncSubscription } from '@/modules/stripe/service';

// Must be nodejs runtime — edge does not support crypto.subtle for HMAC verification
export const runtime = 'nodejs';

// Opt out of Next.js body parsing so we can verify the raw body
export const dynamic = 'force-dynamic';

/** GET /api/stripe/webhook — returns 405 so browsers display JSON instead of downloading an empty body. */
export function GET(): NextResponse {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Webhook endpoint only accepts POST requests.' } },
    { status: 405 },
  );
}

/** POST /api/stripe/webhook */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'stripe.webhook.start' });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log.error({ action: 'stripe.webhook.missing_secret' });
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Webhook secret not configured' } },
      { status: 500 },
    );
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' } },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = getStripe().webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    log.warn({ action: 'stripe.webhook.invalid_signature', err });
    return NextResponse.json(
      { error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient() as unknown as SupabaseClient;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        if (!userId || session.mode !== 'subscription') break;

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id;

        if (!subscriptionId || !customerId) {
          log.warn({ action: 'stripe.webhook.missing_ids', sessionId: session.id });
          break;
        }

        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        await syncSubscription(admin, userId, customerId, subscription, log);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

        // Resolve user_id from the subscriptions table
        const { data: subRow } = await admin
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle() as unknown as { data: { user_id: string } | null };

        if (!subRow?.user_id) {
          log.warn({ action: 'stripe.webhook.unknown_customer', customerId });
          break;
        }

        await syncSubscription(admin, subRow.user_id, customerId, subscription, log);
        break;
      }

      default:
        log.info({ action: 'stripe.webhook.unhandled', type: event.type });
    }

    log.info({ action: 'stripe.webhook.done', type: event.type });
    return NextResponse.json({ received: true });
  } catch (err) {
    log.error({ action: 'stripe.webhook.handler_error', type: event.type, err });
    return NextResponse.json(
      { error: { code: 'HANDLER_ERROR', message: 'Webhook processing failed' } },
      { status: 500 },
    );
  }
}
