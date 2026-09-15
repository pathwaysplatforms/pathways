/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session for the signed-in user and returns {url}.
 * The client redirects window.location to that URL to update payment details or cancel.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createRequestLogger } from '@/lib/logger';
import { requireAuth } from '@/modules/auth/service';
import { getStripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createBillingPortalSession } from '@/modules/stripe/service';
import { AuthError, NotFoundError } from '@/lib/errors';

export const runtime = 'nodejs';

/** POST /api/stripe/portal */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();
  const log = createRequestLogger(correlationId);
  log.info({ action: 'stripe.portal.request.start' });

  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Sign in to manage your subscription' } },
        { status: 401 },
      );
    }
    throw err;
  }

  try {
    const stripe = getStripe();
    const admin = createSupabaseAdminClient() as unknown as SupabaseClient;
    const origin = req.headers.get('origin') ?? 'http://localhost:3000';

    const url = await createBillingPortalSession(
      stripe,
      admin,
      user.id,
      `${origin}/account`,
      log,
    );

    log.info({ action: 'stripe.portal.request.done' });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { error: { code: 'NO_SUBSCRIPTION', message: 'No subscription to manage yet' } },
        { status: 404 },
      );
    }
    log.error({ action: 'stripe.portal.request.error', err });
    return NextResponse.json(
      { error: { code: 'PORTAL_ERROR', message: 'Failed to open the billing portal' } },
      { status: 500 },
    );
  }
}
