// goal:guest-free-and-paid:9
import { describe, expect, test } from 'bun:test';
import type { CatalogSpec } from '@pkgs/billing';
import { StripeBilling } from './stripe-billing';
import { translateStripeEvent } from './translate-event';

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
          create: () =>
            Promise.resolve({
              id: 'bps_1',
              url: 'https://billing.test/portal/cus_1',
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

  test('createCustomer carries the account id in metadata', async () => {
    let created: unknown = null;
    const stripe = {
      customers: {
        create: (input: unknown) => {
          created = input;
          return Promise.resolve({ id: 'cus_new' });
        },
      },
    };
    const billing = new StripeBilling(stripe as never);
    expect(await billing.createCustomer({ accountId: 'acct-1' })).toEqual({
      customerId: 'cus_new',
    });
    expect(created).toEqual({ metadata: { accountId: 'acct-1' } });
  });

  test('createCheckoutSession resolves the price by lookup key', async () => {
    const sessionInputs: Array<Record<string, unknown>> = [];
    const stripe = {
      prices: {
        list: () => Promise.resolve({ data: [{ id: 'price_1' }] }),
      },
      checkout: {
        sessions: {
          create: (input: Record<string, unknown>) => {
            sessionInputs.push(input);
            return Promise.resolve({
              id: 'cs_1',
              url: 'https://pay.test/cs_1',
            });
          },
        },
      },
    };
    const billing = new StripeBilling(stripe as never);
    const session = await billing.createCheckoutSession({
      customerId: 'cus_1',
      priceKey: 'subscription_monthly',
      successUrl: 'https://app.test/ok',
      cancelUrl: 'https://app.test/cancel',
    });
    expect(session.url).toBe('https://pay.test/cs_1');
    expect(sessionInputs[0]?.['line_items']).toEqual([
      { price: 'price_1', quantity: 1 },
    ]);
    expect(sessionInputs[0]?.['mode']).toBe('subscription');
  });

  test('webhook verification fails closed without a signing secret', async () => {
    const billing = new StripeBilling({} as never);
    await expect(
      billing.verifyWebhook({ rawBody: '{}', signature: 'sig' })
    ).rejects.toThrow('webhook secret is not configured');
  });

  test('syncCatalog creates product and price via stub', async () => {
    const products: Array<Record<string, unknown>> = [];
    const prices: Array<Record<string, unknown>> = [];
    let seq = 0;
    const stripe = {
      products: {
        list: () => ({
          async *[Symbol.asyncIterator]() {
            for (const product of products) yield product;
          },
        }),
        create: (input: Record<string, unknown>) => {
          seq += 1;
          const product = {
            id: `prod_${String(seq)}`,
            active: true,
            created: seq,
            ...input,
          };
          products.push(product);
          return Promise.resolve(product);
        },
        update: (id: string, input: Record<string, unknown>) => {
          const found = products.find((p) => p['id'] === id);
          if (found !== undefined) Object.assign(found, input);
          return Promise.resolve(found);
        },
      },
      prices: {
        list: () => Promise.resolve({ data: prices }),
        create: (input: Record<string, unknown>) => {
          seq += 1;
          const price = { id: `price_${String(seq)}`, active: true, ...input };
          prices.push(price);
          return Promise.resolve(price);
        },
        update: (id: string, input: Record<string, unknown>) => {
          const found = prices.find((p) => p['id'] === id);
          if (found !== undefined) Object.assign(found, input);
          return Promise.resolve(found);
        },
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

describe('translateStripeEvent', () => {
  test('maps an updated subscription to account, status and period end', () => {
    expect(
      translateStripeEvent({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_1',
            status: 'past_due',
            cancel_at_period_end: true,
            metadata: { accountId: 'acct-1' },
            items: {
              data: [
                {
                  current_period_end: 1_700_000_000,
                  price: { lookup_key: 'subscription_monthly' },
                },
              ],
            },
          },
        },
      })
    ).toEqual({
      kind: 'subscription_changed',
      accountId: 'acct-1',
      providerSubscriptionId: 'sub_1',
      priceKey: 'subscription_monthly',
      status: 'past_due',
      currentPeriodEndMs: 1_700_000_000_000,
      cancelAtPeriodEnd: true,
    });
  });

  test('a deleted subscription reports canceled with its period end', () => {
    const event = translateStripeEvent({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          metadata: { accountId: 'acct-1' },
          current_period_end: 1_700_000_000,
        },
      },
    });
    if (event.kind !== 'subscription_changed')
      throw new Error('expected change');
    expect(event.status).toBe('canceled');
    expect(event.currentPeriodEndMs).toBe(1_700_000_000_000);
  });

  test('unrelated events are ignored', () => {
    expect(
      translateStripeEvent({
        type: 'invoice.payment_failed',
        data: { object: {} },
      })
    ).toEqual({ kind: 'ignored', type: 'invoice.payment_failed' });
  });
});
