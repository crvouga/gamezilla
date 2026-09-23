import { describe, expect, test } from 'bun:test';
import type { PlusMembershipOffer } from '@pkgs/billing';
import { createNoopLogger } from '@pkgs/logger';
import { reconcileStripeOffer } from './offer-reconcile';

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
    businessProfileHeadline: 'Gamezilla Unlimited',
    cancellationReasons: ['too_expensive', 'other'],
  },
  callbackPath: '/api/billing/callback',
};

type Store = {
  readonly products: Array<Record<string, unknown>>;
  readonly prices: Array<Record<string, unknown>>;
  readonly portalConfigurations: Array<Record<string, unknown>>;
  readonly webhookEndpoints: Array<Record<string, unknown>>;
  seq: number;
};

/** Enough of the Stripe client to reconcile the offer and read it back. */
function stubStripe(store: Store): unknown {
  const matchPrice = (input: Record<string, unknown>): unknown[] => {
    const keys = (input['lookup_keys'] as readonly string[] | undefined) ?? [];
    return store.prices.filter(
      (price) =>
        keys.includes(String(price['lookup_key'])) && price['active'] === true
    );
  };
  const stripe = {
    products: {
      list: () => ({
        async *[Symbol.asyncIterator]() {
          for (const product of store.products) yield product;
        },
      }),
      create: (input: Record<string, unknown>) => {
        store.seq += 1;
        const product = {
          id: `prod_${String(store.seq)}`,
          active: true,
          created: store.seq,
          ...input,
        };
        store.products.push(product);
        return Promise.resolve(product);
      },
      update: (id: string, input: Record<string, unknown>) => {
        const found = store.products.find((p) => p['id'] === id);
        if (found !== undefined) Object.assign(found, input);
        return Promise.resolve(found);
      },
    },
    prices: {
      list: (input: Record<string, unknown>) =>
        Promise.resolve({ data: matchPrice(input) }),
      create: (input: Record<string, unknown>) => {
        store.seq += 1;
        const price = {
          id: `price_${String(store.seq)}`,
          active: true,
          ...input,
        };
        store.prices.push(price);
        return Promise.resolve(price);
      },
      update: (id: string, input: Record<string, unknown>) => {
        const found = store.prices.find((p) => p['id'] === id);
        if (found !== undefined) Object.assign(found, input);
        return Promise.resolve(found);
      },
      retrieve: (id: string) =>
        Promise.resolve(store.prices.find((p) => p['id'] === id)),
    },
    billingPortal: {
      configurations: {
        list: () => Promise.resolve({ data: store.portalConfigurations }),
        create: (input: Record<string, unknown>) => {
          const configuration = {
            id: 'bpc_1',
            active: true,
            created: 1,
            default_return_url: input['default_return_url'] ?? null,
            ...input,
          };
          store.portalConfigurations.push(configuration);
          return Promise.resolve(configuration);
        },
        update: (id: string, input: Record<string, unknown>) => {
          const found = store.portalConfigurations.find((c) => c['id'] === id);
          if (found !== undefined) Object.assign(found, input);
          return Promise.resolve(found);
        },
      },
    },
    webhookEndpoints: {
      list: () => Promise.resolve({ data: store.webhookEndpoints }),
      create: (input: Record<string, unknown>) => {
        const endpoint = { id: 'we_1', status: 'enabled', ...input };
        store.webhookEndpoints.push(endpoint);
        return Promise.resolve(endpoint);
      },
      update: (id: string, input: Record<string, unknown>) => {
        const found = store.webhookEndpoints.find((e) => e['id'] === id);
        if (found !== undefined) Object.assign(found, input);
        return Promise.resolve(found);
      },
    },
  };
  return stripe;
}

const ctx = { callbackUrl: 'https://api.test/api/billing/callback/stripe' };
const log = createNoopLogger();

function emptyStore(): Store {
  return {
    products: [],
    prices: [],
    portalConfigurations: [],
    webhookEndpoints: [],
    seq: 0,
  };
}

describe('reconcileStripeOffer', () => {
  test('creates the product, both prices, the portal and the webhook', async () => {
    const store = emptyStore();
    const result = await reconcileStripeOffer(
      stubStripe(store) as never,
      offer,
      ctx,
      log
    );
    expect(result.products).toHaveLength(1);
    expect(result.prices).toHaveLength(2);
    expect(result.portalConfigurationId).toBe('bpc_1');
    expect(result.webhookEndpointId).toBe('we_1');
    expect(store.webhookEndpoints[0]?.['url']).toBe(ctx.callbackUrl);

    const features = store.portalConfigurations[0]?.['features'] as
      | Record<string, unknown>
      | undefined;
    expect(features?.['subscription_cancel']).toMatchObject({
      enabled: true,
      mode: 'at_period_end',
    });
    expect(features?.['subscription_update']).toMatchObject({
      enabled: true,
      proration_behavior: 'create_prorations',
      products: [{ product: 'prod_1', prices: ['price_2', 'price_3'] }],
    });
    expect(store.portalConfigurations[0]?.['default_return_url']).toBe(
      'https://api.test/more/billing'
    );

    const monthly = store.prices.find(
      (p) => p['lookup_key'] === 'subscription_monthly'
    );
    expect(monthly?.['recurring']).toEqual({
      interval: 'month',
      trial_period_days: 7,
    });
    expect(monthly?.['currency_options']).toEqual({
      inr: { unit_amount: 29_900 },
    });
  });

  test('a second run is a no-op', async () => {
    const store = emptyStore();
    await reconcileStripeOffer(stubStripe(store) as never, offer, ctx, log);
    const created = {
      products: store.products.length,
      prices: store.prices.length,
      portals: store.portalConfigurations.length,
      webhooks: store.webhookEndpoints.length,
    };
    const second = await reconcileStripeOffer(
      stubStripe(store) as never,
      offer,
      ctx,
      log
    );
    expect(store.products).toHaveLength(created.products);
    expect(store.prices).toHaveLength(created.prices);
    expect(store.portalConfigurations).toHaveLength(created.portals);
    expect(store.webhookEndpoints).toHaveLength(created.webhooks);
    expect(second.portalConfigurationId).toBe('bpc_1');
  });

  test('a moved callback path moves our endpoint, keeping its secret', async () => {
    const store = emptyStore();
    const old = { callbackUrl: 'https://api.test/api/billing/callback' };
    await reconcileStripeOffer(stubStripe(store) as never, offer, old, log);
    const result = await reconcileStripeOffer(
      stubStripe(store) as never,
      offer,
      ctx,
      log
    );
    expect(store.webhookEndpoints).toHaveLength(1);
    expect(result.webhookEndpointId).toBe('we_1');
    expect(store.webhookEndpoints[0]?.['url']).toBe(ctx.callbackUrl);
  });
});
