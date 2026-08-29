/**
 * One-off Stripe test-mode setup.
 * Run: npx tsx --env-file=.env.local scripts/stripe-setup.ts
 *
 * Creates: Product → Price → 100%-off Coupon → Promo code TESTACCESS
 * Prints IDs to add to .env.local.
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error('STRIPE_SECRET_KEY not found — pass --env-file=.env.local');
if (!key.startsWith('sk_test_')) throw new Error('This script only runs against test mode keys');

const stripe = new Stripe(key, { apiVersion: '2026-06-24.dahlia' });

async function main() {
  console.log('🔧  Pathways Stripe test-mode setup\n');

  const product = await stripe.products.create({
    name: 'Pathways Pro',
    description: 'Full access to every Pathways tool for your Canadian immigration journey.',
  });
  console.log('✅  Product created:', product.id);

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 9900,   // $99.00
    currency: 'cad',
    recurring: { interval: 'year' },
    nickname: 'Pathways Pro — Annual',
  });
  console.log('✅  Price created:', price.id, '($99 CAD / year)');

  const coupon = await stripe.coupons.create({
    percent_off: 100,
    duration: 'once',
    name: 'Test Access — 100% off',
  });
  console.log('✅  Coupon created:', coupon.id);

  const promoCode = await stripe.promotionCodes.create({
    promotion: { coupon: coupon.id, type: 'coupon' },
    code: 'TESTACCESS',
  });
  console.log('✅  Promo code created:', promoCode.id, '(code: TESTACCESS)\n');

  console.log('─── Add these to .env.local ────────────────────────────────');
  console.log(`STRIPE_PRODUCT_ID=${product.id}`);
  console.log(`STRIPE_PRICE_ID=${price.id}`);
  console.log(`STRIPE_COUPON_ID=${coupon.id}`);
  console.log(`STRIPE_PROMO_CODE_ID=${promoCode.id}`);
  console.log('────────────────────────────────────────────────────────────');
  console.log('\nNext: get your local webhook secret →');
  console.log('  stripe listen --forward-to localhost:3000/api/stripe/webhook');
  console.log('  # Copy the whsec_... value into STRIPE_WEBHOOK_SECRET in .env.local');
}

main().catch((e) => { console.error(e); process.exit(1); });
