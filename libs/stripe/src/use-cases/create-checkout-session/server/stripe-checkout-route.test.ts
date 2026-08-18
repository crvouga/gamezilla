import { describe, expect, it } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { StripeCheckoutRoutes } from './stripe-checkout-route';

describe('StripeCheckoutRoutes', () => {
  it('returns 503 when Stripe is not configured', async () => {
    const sql = {
      query: async () => [],
      run: async () => ({ changes: 0 }),
      transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
        fn(sql as SqlClient),
      disconnect: async () => {},
    } as unknown as SqlClient;

    const app = new StripeCheckoutRoutes(
      () => sql,
      null,
      async () => {
        throw new Error('should not be called');
      }
    ).build();

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
