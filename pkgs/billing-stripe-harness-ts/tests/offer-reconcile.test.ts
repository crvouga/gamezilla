import { describe, expect, test } from 'bun:test';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared-ts/offer';
import { StripeTestMode } from '@pkgs/billing-stripe-harness-ts/stripe-test-mode';
import { reconcileStripeOffer } from '@pkgs/billing-stripe-shared-ts/offer-reconcile';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';

const offer: PlusMembershipOffer = {
  product: {
    catalogProductId: 'subscription',
    name: 'Unlimited',
    description: 'Test product',
  },
  prices: {
    subscription_monthly: {
      key: 'subscription_monthly',
      catalogPriceId: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 7,
      currencyOptions: { inr: { unitAmount: 29_900 } },
    },
    subscription_yearly: {
      key: 'subscription_yearly',
      catalogPriceId: 'subscription_yearly',
      unitAmount: 6000,
      currency: 'usd',
      interval: 'year',
      trialPeriodDays: 7,
      currencyOptions: { inr: { unitAmount: 499_00 } },
    },
  },
  defaultPriceKey: 'subscription_monthly',
  switchablePriceKeys: ['subscription_monthly', 'subscription_yearly'],
  portal: {
    defaultReturnUrlPath: '/more/billing',
    businessProfileHeadline: 'Acme Unlimited',
    cancellationReasons: ['too_expensive', 'other'],
  },
  callbackPath: '/api/billing/callback',
  callbackDescription: 'Acme membership callbacks',
};

const ctx = { callbackUrl: 'https://api.test/api/billing/callback/stripe' };
const log = createNoopLogger();

/** What Stripe holds after a reconcile, as a tester lists it. */
async function catalogOf(stripe: StripeTestMode) {
  const [products, prices, portals, webhooks] = await Promise.all([
    stripe.stripe.products.list({ limit: 100 }),
    stripe.stripe.prices.list({
      limit: 100,
      expand: ['data.currency_options'],
    }),
    stripe.stripe.billingPortal.configurations.list({ limit: 100 }),
    stripe.stripe.webhookEndpoints.list({ limit: 100 }),
  ]);
  return {
    products: products.data,
    prices: prices.data,
    portals: portals.data,
    webhooks: webhooks.data,
  };
}

describe('reconcileStripeOffer', () => {
  test('creates the product, both prices, the portal and the webhook', async () => {
    const stripe = new StripeTestMode({ nowMs: 1_800_000_000_000 });
    const result = await reconcileStripeOffer(stripe.stripe, offer, ctx, log);
    expect(result.products).toHaveLength(1);
    expect(result.prices).toHaveLength(2);

    const catalog = await catalogOf(stripe);
    const [webhook] = catalog.webhooks;
    expect(webhook?.id).toBe(result.webhookEndpointId);
    expect(webhook?.url).toBe(ctx.callbackUrl);

    const portal = catalog.portals.find(
      (c) => c.id === result.portalConfigurationId
    );
    expect(portal?.features.subscription_cancel).toMatchObject({
      enabled: true,
      mode: 'at_period_end',
    });
    const priceIds = result.prices.map((p) => p.priceId);
    expect(portal?.features.subscription_update).toMatchObject({
      enabled: true,
      proration_behavior: 'create_prorations',
      trial_update_behavior: 'continue_trial',
      products: [{ product: result.products[0]?.productId, prices: priceIds }],
    });
    expect(portal?.default_return_url).toBe('https://api.test/more/billing');

    const monthly = catalog.prices.find(
      (p) => p.lookup_key === 'subscription_monthly'
    );
    expect(monthly?.recurring).toMatchObject({
      interval: 'month',
      trial_period_days: 7,
    });
    expect(monthly?.currency_options?.['inr']?.unit_amount).toBe(29_900);
  });

  test('a second run is a no-op', async () => {
    const stripe = new StripeTestMode({ nowMs: 1_800_000_000_000 });
    const first = await reconcileStripeOffer(stripe.stripe, offer, ctx, log);
    const before = await catalogOf(stripe);
    const second = await reconcileStripeOffer(stripe.stripe, offer, ctx, log);
    const after = await catalogOf(stripe);
    expect(after.products.map((p) => p.id)).toEqual(
      before.products.map((p) => p.id)
    );
    expect(after.prices.map((p) => [p.id, p.active])).toEqual(
      before.prices.map((p) => [p.id, p.active])
    );
    expect(after.portals.map((p) => p.id)).toEqual(
      before.portals.map((p) => p.id)
    );
    expect(after.webhooks.map((w) => w.id)).toEqual(
      before.webhooks.map((w) => w.id)
    );
    expect(second).toEqual(first);
  });

  test('a moved callback path moves our endpoint, keeping its secret', async () => {
    const stripe = new StripeTestMode({ nowMs: 1_800_000_000_000 });
    const old = { callbackUrl: 'https://api.test/api/billing/callback' };
    const first = await reconcileStripeOffer(stripe.stripe, offer, old, log);
    const secret = stripe.runtime.instance().apiWebhookEndpoints()[0]?.secret;
    const moved = await reconcileStripeOffer(stripe.stripe, offer, ctx, log);
    const { webhooks } = await catalogOf(stripe);
    expect(webhooks.map((w) => [w.id, w.url])).toEqual([
      [first.webhookEndpointId, ctx.callbackUrl],
    ]);
    expect(moved.webhookEndpointId).toBe(first.webhookEndpointId);
    expect(stripe.runtime.instance().apiWebhookEndpoints()[0]?.secret).toBe(
      secret
    );
  });
});
