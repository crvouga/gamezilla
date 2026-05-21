import type { PatchDb } from '@pkgs/patch-db/interface';
import { describe, expect, it } from 'bun:test';
import { createStripeCheckoutRoutes } from './stripe-checkout-route';

describe('createStripeCheckoutRoutes', () => {
  it('returns 503 when Stripe is not configured', async () => {
    const db = {
      read: async () => [],
      write: async () => [],
    } as unknown as PatchDb;

    const app = createStripeCheckoutRoutes({
      getPatchDb: () => db,
      stripe: null,
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
