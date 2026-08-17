/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the Pro annual plan and returns {url}.
 * The client redirects window.location to that URL.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth } from '@/modules/auth/service';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AuthError } from '@/lib/errors';

export const runtime = 'nodejs';

/** POST /api/stripe/checkout */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'stripe.checkout.start' });

  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sign in to upgrade' } },
        { status: 401 },
      );
    }
    throw err;
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    log.error({ action: 'stripe.checkout.missing_price_id' });
    return NextResponse.json(
      { error: { code: 'CONFIG_ERROR', message: 'Stripe price not configured' } },
      { status: 500 },
    );
  }

  try {
    const stripe = getStripe();
    const admin = createSupabaseAdminClient() as unknown as SupabaseClient;

    // Reuse existing Stripe customer if one exists for this user
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle() as unknown as { data: { stripe_customer_id: string | null } | null };

    const origin = req.headers.get('origin') ?? 'http://localhost:3000';

    // When a test promo code is configured, auto-apply it so the checkout opens
    // at $0 and testers never need to type a code. In production (no env var set)
    // the promo code field is shown so real codes can be entered manually.
    const promoCodeId = process.env.STRIPE_PROMO_CODE_ID ?? null;

    type CheckoutParams = Parameters<typeof stripe.checkout.sessions.create>[0];
    const params: CheckoutParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/dashboard?checkout=canceled`,
      ...(promoCodeId
        ? { discounts: [{ promotion_code: promoCodeId }] }
        : { allow_promotion_codes: true }),
    };

    if (existingSub?.stripe_customer_id) {
      params.customer = existingSub.stripe_customer_id;
    } else {
      const { data: authUser } = await admin.auth.admin.getUserById(user.id);
      if (authUser?.user?.email) {
        params.customer_email = authUser.user.email;
      }
    }

    const session = await stripe.checkout.sessions.create(params);
    log.info({ action: 'stripe.checkout.done', sessionId: session.id });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    log.error({ action: 'stripe.checkout.error', err });
    return NextResponse.json(
      { error: { code: 'CHECKOUT_ERROR', message: 'Failed to create checkout session' } },
      { status: 500 },
    );
  }
}
