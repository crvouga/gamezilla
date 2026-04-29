import { createEntityDbInMemory } from '@gamezilla/lib/entity-db/factory';
import { describe, expect, it } from 'bun:test';
import { createStripeCheckoutRoutes } from './stripe-checkout-route';
import { stripeWebhookCompareVersions } from './webhook-cache-entity-db';

describe('createStripeCheckoutRoutes', () => {
  it('returns 503 when Stripe is not configured', async () => {
    const db = {
      read: async () => [],
      write: async () => {},
    } as unknown as import('@gamezilla/patch-db/interface').PatchesDb;

    const stripeCache = createEntityDbInMemory(stripeWebhookCompareVersions);

    const app = createStripeCheckoutRoutes({
      db,
      stripe: null,
      stripeCache,
      requireAuth: async () => {
        throw new Error('should not be called');
      },
    });

    const res = await app.request('/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceKey: 'subscription_monthly',
        successUrl: 'https://example.com/s',
        cancelUrl: 'https://example.com/c',
      }),
    });

    expect(res.status).toBe(503);
  });
});
