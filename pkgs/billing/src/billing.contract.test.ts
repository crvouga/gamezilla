// goal:room-to-grow:4
import { describe, expect, it } from 'bun:test';
import type {
  Billing,
  BillingCustomer,
  BillingEvent,
  CheckoutSession,
  CreateCheckoutSessionInput,
  CreateCustomerInput,
  PortalSession,
} from './billing';
import type { CatalogSpec, CatalogSyncResult, PriceSpec } from './catalog';
import {
  decidePriceReconcile,
  normalizeCurrencyOptions,
  priceMatchesSpec,
} from './catalog-reconcile';
import { InMemoryBilling } from './in-memory-billing';

const monthlySpec: PriceSpec = {
  product: 'subscription',
  lookupKey: 'subscription_monthly',
  unitAmount: 700,
  currency: 'usd',
  recurring: { interval: 'month' },
  currencyOptions: {
    inr: { unitAmount: 29_900 },
    brl: { unitAmount: 1990 },
  },
};

const fixtureSpec: CatalogSpec = {
  products: {
    subscription: {
      catalogProductId: 'subscription',
      name: 'Unlimited',
      description: 'Test catalog product',
    },
  },
  prices: {
    subscription_monthly: monthlySpec,
  },
};

describe('normalizeCurrencyOptions', () => {
  it('lowercases keys and extracts unitAmount', () => {
    expect(
      normalizeCurrencyOptions({
        INR: { unitAmount: 100 },
        brl: { unitAmount: 200 },
      })
    ).toEqual({ inr: 100, brl: 200 });
  });
});

const prodId = 'prod_catalog_subscription';

describe('priceMatchesSpec', () => {
  it('returns true when live matches spec', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(true);
  });

  it('returns true when live has extra currency options not in spec', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
            eur: { unitAmount: 600 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(true);
  });

  it('returns false when currency options drift', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_901 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(false);
  });

  it('returns false when product id does not match', () => {
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: 'prod_other',
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe(false);
  });

  it('returns true when spec trial matches live trial', () => {
    const trialSpec: PriceSpec = {
      ...monthlySpec,
      recurring: { interval: 'month', trialPeriodDays: 7 },
    };
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month', trialPeriodDays: 7 },
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        trialSpec,
        prodId
      )
    ).toBe(true);
  });

  it('returns false when spec declares trial but live has none', () => {
    const trialSpec: PriceSpec = {
      ...monthlySpec,
      recurring: { interval: 'month', trialPeriodDays: 7 },
    };
    expect(
      priceMatchesSpec(
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month', trialPeriodDays: null },
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        trialSpec,
        prodId
      )
    ).toBe(false);
  });
});

describe('decidePriceReconcile', () => {
  it('returns replace when no live price', () => {
    expect(decidePriceReconcile(null, null, monthlySpec, prodId)).toBe(
      'replace'
    );
  });

  it('returns noop when live matches', () => {
    expect(
      decidePriceReconcile(
        { id: 'price_1' },
        {
          unitAmount: 700,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currencyOptions: {
            inr: { unitAmount: 29_900 },
            brl: { unitAmount: 1990 },
          },
        },
        monthlySpec,
        prodId
      )
    ).toBe('noop');
  });

  it('returns replace when live mismatches', () => {
    expect(
      decidePriceReconcile(
        { id: 'price_1' },
        {
          unitAmount: 800,
          currency: 'usd',
          recurring: { interval: 'month' },
          active: true,
          product: prodId,
          currencyOptions: {},
        },
        monthlySpec,
        prodId
      )
    ).toBe('replace');
  });
});

describe('InMemoryBilling contract', () => {
  it('createPortalSession returns deterministic url', async () => {
    const billing = new InMemoryBilling({ baseUrl: 'https://billing.test' });
    const session = await billing.createPortalSession({
      customerId: 'cus_1',
      returnUrl: 'https://app.test/return',
    });
    expect(session.id).toBe('bps_sim_1');
    expect(session.url).toBe('https://billing.test/portal/cus_1');
  });

  it('armPortalFailure throws once then succeeds', async () => {
    const billing = new InMemoryBilling({ baseUrl: 'https://billing.test' });
    billing.armPortalFailure();
    await expect(
      billing.createPortalSession({
        customerId: 'cus_1',
        returnUrl: 'https://app.test/return',
      })
    ).rejects.toThrow('portal failed');
    const session = await billing.createPortalSession({
      customerId: 'cus_1',
      returnUrl: 'https://app.test/return',
    });
    expect(session.url).toContain('https://billing.test');
  });

  it('syncCatalog is idempotent for stable ids', async () => {
    const billing = new InMemoryBilling();
    const first = await billing.syncCatalog(fixtureSpec);
    const second = await billing.syncCatalog(fixtureSpec);
    expect(first.products).toEqual(second.products);
    expect(first.prices).toEqual(second.prices);
    expect(first.products[0]?.productId).toMatch(/^prod_sim_/);
    expect(first.prices[0]?.priceId).toMatch(/^price_sim_/);
  });
});

describe('the port admits another payment provider', () => {
  /** Minimal second implementation: same port, different vendor identity. */
  class OtherProviderBilling implements Billing {
    private readonly seen: string[] = [];

    async createCustomer(input: CreateCustomerInput): Promise<BillingCustomer> {
      this.seen.push(input.accountId);
      return { customerId: `other_cus_${input.accountId}` };
    }

    async createCheckoutSession(
      input: CreateCheckoutSessionInput
    ): Promise<CheckoutSession> {
      return { id: 'other_cs', url: `https://other.test/${input.priceKey}` };
    }

    createPortalSession(): Promise<PortalSession> {
      return Promise.resolve({ id: 'other_bps', url: 'https://other.test/p' });
    }

    createCheckoutSessions(): readonly string[] {
      return this.seen;
    }

    verifyWebhook(): Promise<BillingEvent> {
      return Promise.resolve({
        kind: 'subscription_changed',
        accountId: 'acct',
        providerSubscriptionId: 'sub',
        priceKey: null,
        status: 'active',
        currentPeriodEndMs: null,
        cancelAtPeriodEnd: false,
      });
    }

    syncCatalog(spec: CatalogSpec): Promise<CatalogSyncResult> {
      return Promise.resolve({
        products: Object.keys(spec.products).map((key) => ({
          key,
          productId: `other_${key}`,
        })),
        prices: Object.keys(spec.prices).map((key) => ({
          key,
          priceId: `other_${key}`,
        })),
      });
    }
  }

  it('runs the same purchase flow with limits untouched', async () => {
    const billing: Billing = new OtherProviderBilling();
    const customer = await billing.createCustomer({ accountId: 'acct-1' });
    const session = await billing.createCheckoutSession({
      customerId: customer.customerId,
      priceKey: 'subscription_monthly',
      successUrl: 'https://app.test/ok',
      cancelUrl: 'https://app.test/cancel',
    });
    expect(session.url).toBe('https://other.test/subscription_monthly');
    const event = await billing.verifyWebhook({
      rawBody: '{}',
      signature: 'sig',
    });
    expect(event.kind).toBe('subscription_changed');
    const catalog = await billing.syncCatalog(fixtureSpec);
    expect(catalog.prices[0]?.priceId).toBe('other_subscription_monthly');
  });
});
