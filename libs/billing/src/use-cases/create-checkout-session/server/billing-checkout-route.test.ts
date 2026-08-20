import { describe, expect, it } from 'bun:test';
import { InMemoryBilling } from '@pkgs/billing';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { BillingCheckoutRoutes } from './billing-checkout-route';

describe('BillingCheckoutRoutes', () => {
  it('returns 503 when billing is not configured', async () => {
    const sql = {
      query: async () => [],
      run: async () => ({ changes: 0 }),
      transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
        fn(sql as SqlClient),
      disconnect: async () => {},
    } as unknown as SqlClient;

    const app = new BillingCheckoutRoutes(
      () => sql,
      null,
      async () => {
        throw new Error('should not be called');
      },
      () => 0
    ).build();

    const res = await app.request('/billing/checkout', {
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

  it('returns portal url when billing is configured', async () => {
    const sql = {
      query: async () => [{ external_id: 'cus_test_1' }],
      run: async () => ({ changes: 0 }),
      transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
        fn(sql as SqlClient),
      disconnect: async () => {},
    } as unknown as SqlClient;

    const billing = new InMemoryBilling({ baseUrl: 'https://billing.test' });
    const app = new BillingCheckoutRoutes(
      () => sql,
      billing,
      async () => ({ accountId: 'acc_1', deviceId: 'dev_1' }),
      () => 0
    ).build();

    const res = await app.request('/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnUrl: 'https://example.com/return',
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { url: string };
    expect(json.url).toContain('https://billing.test/portal/cus_test_1');
  });
});
