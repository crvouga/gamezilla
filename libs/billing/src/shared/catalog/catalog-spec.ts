/**
 * Declarative catalog SPEC — source of truth for products/prices we offer.
 * Reconciled onto the billing provider via {@link Billing.syncCatalog}.
 *
 * Durable identity at the provider:
 *   - Products: catalogProductId
 *   - Prices: lookupKey (also used as checkout priceKey)
 *
 * Currency amounts are integer minor units (e.g. cents). PPP-tier amounts
 * approximate USD purchasing power for each region.
 */
import type { CatalogSpec, PriceSpec } from '@pkgs/billing';

export const CATALOG_SPEC = {
  products: {
    subscription: {
      catalogProductId: 'subscription',
      name: 'Unlimited',
      description: 'Get unlimited access to Gamezilla servers.',
    },
  },
  prices: {
    subscription_monthly: {
      product: 'subscription',
      lookupKey: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      recurring: { interval: 'month' as const, trialPeriodDays: 7 },
      currencyOptions: {
        inr: { unitAmount: 4900 },
        brl: { unitAmount: 2090 },
        ngn: { unitAmount: 6600 },
        zar: { unitAmount: 12900 },
        kes: { unitAmount: 950 },
        eur: { unitAmount: 650 },
        gbp: { unitAmount: 570 },
        aud: { unitAmount: 1050 },
        cad: { unitAmount: 950 },
        mxn: { unitAmount: 119 },
        jpy: { unitAmount: 1050 },
        sgd: { unitAmount: 930 },
        php: { unitAmount: 390 },
      },
    },
    subscription_yearly: {
      product: 'subscription',
      lookupKey: 'subscription_yearly',
      unitAmount: 6000,
      currency: 'usd',
      recurring: { interval: 'year' as const, trialPeriodDays: 7 },
      currencyOptions: {
        inr: { unitAmount: 49900 },
        brl: { unitAmount: 20900 },
        ngn: { unitAmount: 66000 },
        zar: { unitAmount: 129000 },
        kes: { unitAmount: 9500 },
        eur: { unitAmount: 5590 },
        gbp: { unitAmount: 4890 },
        aud: { unitAmount: 8890 },
        cad: { unitAmount: 7990 },
        mxn: { unitAmount: 10190 },
        jpy: { unitAmount: 8990 },
        sgd: { unitAmount: 7990 },
        php: { unitAmount: 33500 },
      },
    },
  },
} as const satisfies CatalogSpec & {
  readonly prices: Record<string, PriceSpec>;
};

export type CatalogProductKey = keyof typeof CATALOG_SPEC.products;
export type CatalogPriceKey = keyof typeof CATALOG_SPEC.prices;

export const CATALOG_PRICE_KEYS = Object.keys(CATALOG_SPEC.prices) as [
  CatalogPriceKey,
  ...CatalogPriceKey[],
];
