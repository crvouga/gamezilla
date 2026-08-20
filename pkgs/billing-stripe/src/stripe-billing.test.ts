import { describe, expect, test } from 'bun:test';
import type { CatalogSpec } from '@pkgs/billing';
import { StripeBilling } from './stripe-billing';

const fixtureSpec: CatalogSpec = {
  products: {
    subscription: {
      catalogProductId: 'subscription',
      name: 'Unlimited',
      description: 'Test',
    },
  },
  prices: {
    subscription_monthly: {
      product: 'subscription',
      lookupKey: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      recurring: { interval: 'month', trialPeriodDays: 7 },
      currencyOptions: { eur: { unitAmount: 650 } },
    },
  },
};

describe('StripeBilling', () => {
  test('createPortalSession maps url', async () => {
    const stripe = {
      billingPortal: {
        sessions: {
          create: async (params: { customer: string; return_url: string }) => ({
            id: 'bps_1',
            url: `https://billing.test/portal/${params.customer}`,
          }),
        },
      },
    };
    const billing = new StripeBilling(stripe as never);
    const session = await billing.createPortalSession({
      customerId: 'cus_1',
      returnUrl: 'https://app.test/return',
    });
    expect(session.id).toBe('bps_1');
    expect(session.url).toBe('https://billing.test/portal/cus_1');
  });

  test('syncCatalog creates product and price via stub', async () => {
    const products: Array<Record<string, unknown>> = [];
    const prices: Array<Record<string, unknown>> = [];
    let seq = 0;
    const stripe = {
      products: {
        list: async function* () {
          for (const p of products) yield p;
        },
        create: async (params: Record<string, unknown>) => {
          seq += 1;
          const created = {
            id: `prod_${seq}`,
            name: params['name'],
            description: params['description'],
            metadata: params['metadata'],
            created: seq,
          };
          products.push(created);
          return created;
        },
        update: async (id: string, params: Record<string, unknown>) => ({
          id,
          ...params,
        }),
      },
      prices: {
        list: async () => ({ data: [] }),
        retrieve: async (id: string) => ({
          id,
          active: true,
          unit_amount: 700,
          currency: 'usd',
          recurring: { interval: 'month', trial_period_days: 7 },
          product: 'prod_1',
          currency_options: { eur: { unit_amount: 650 } },
        }),
        create: async (params: Record<string, unknown>) => {
          seq += 1;
          const created = { id: `price_${seq}`, ...params, active: true };
          prices.push(created);
          return created;
        },
        update: async (id: string, params: Record<string, unknown>) => ({
          id,
          ...params,
        }),
      },
    };
    const billing = new StripeBilling(stripe as never);
    const result = await billing.syncCatalog(fixtureSpec);
    expect(result.products).toHaveLength(1);
    expect(result.prices).toHaveLength(1);
    expect(result.products[0]?.productId).toMatch(/^prod_/);
    expect(result.prices[0]?.priceId).toMatch(/^price_/);
  });
});
