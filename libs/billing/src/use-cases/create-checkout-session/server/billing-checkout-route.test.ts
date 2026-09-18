// goal:guest-free-and-paid:7
// goal:guest-free-and-paid:8
import { describe, expect, it } from 'bun:test';
import { InMemoryBilling } from '@pkgs/billing';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  BillingCheckoutRoutes,
  type BillingRoutesDeps,
} from './billing-checkout-route';

function fakeSql(rows: readonly unknown[] = []): SqlClient {
  const sql = {
    query: async () => rows,
    run: async () => ({ changes: 0 }),
    transaction: async (fn: (tx: SqlClient) => Promise<unknown>) =>
      fn(sql as unknown as SqlClient),
    disconnect: async () => {},
  } as unknown as SqlClient;
  return sql;
}

function deps(overrides: Partial<BillingRoutesDeps> = {}): BillingRoutesDeps {
  return {
    getSqlClient: () => fakeSql(),
    billing: null,
    requireAuth: async () => ({ accountId: 'acc_1', deviceId: 'dev_1' }),
    createId: (() => 'id-1') as never,
    clock: { now: () => 0 },
    notifyUser: async () => {},
    ...overrides,
  };
}

const CHECKOUT_BODY = {
  priceKey: 'subscription_monthly',
  successUrl: 'https://example.com/s',
  cancelUrl: 'https://example.com/c',
};

describe('BillingCheckoutRoutes', () => {
  it('returns 503 when billing is not configured', async () => {
    const app = new BillingCheckoutRoutes(deps()).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CHECKOUT_BODY),
    });
    expect(res.status).toBe(503);
  });

  it('creates a customer and returns the checkout url', async () => {
    const billing = new InMemoryBilling({ baseUrl: 'https://billing.test' });
    const app = new BillingCheckoutRoutes(
      deps({ billing, getSqlClient: () => fakeSql([{ user_id: 'acc_1' }]) })
    ).build();
    const res = await app.request('/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CHECKOUT_BODY),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { url: string };
    expect(json.url).toContain(
      'https://billing.test/checkout/subscription_monthly/'
    );
  });

  it('returns portal url when billing is configured', async () => {
    const billing = new InMemoryBilling({ baseUrl: 'https://billing.test' });
    const app = new BillingCheckoutRoutes(
      deps({
        billing,
        getSqlClient: () => fakeSql([{ external_id: 'cus_test_1' }]),
      })
    ).build();
    const res = await app.request('/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://example.com/return' }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { url: string };
    expect(json.url).toContain('https://billing.test/portal/cus_test_1');
  });

  it('rejects an unsigned webhook', async () => {
    const billing = new InMemoryBilling();
    const app = new BillingCheckoutRoutes(deps({ billing })).build();
    const res = await app.request('/billing/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'customer.subscription.updated' }),
    });
    expect(res.status).toBe(400);
  });

  it('projects a verified subscription change and notifies the account', async () => {
    const billing = new InMemoryBilling();
    billing.armWebhook({
      status: 'active',
      currentPeriodEndMs: 1_700_000_000_000,
      cancelAtPeriodEnd: false,
    });
    const notified: string[] = [];
    const app = new BillingCheckoutRoutes(
      deps({
        billing,
        getSqlClient: () => fakeSql(),
        notifyUser: async (accountId) => {
          notified.push(accountId);
        },
      })
    ).build();
    const res = await app.request('/billing/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: JSON.stringify({
        accountId: 'acc_1',
        subscriptionId: 'sub_1',
      }),
    });
    expect(res.status).toBe(200);
    expect(notified).toEqual(['acc_1']);
  });
});
