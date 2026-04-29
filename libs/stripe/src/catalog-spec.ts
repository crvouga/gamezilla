/**
 * Declarative catalog SPEC — the single source of truth for Stripe Products
 * and Prices managed by Gamezilla.
 *
 * Consumers:
 *   - `src/sync/catalog.ts` reconciles Stripe to match this spec.
 *   - `stripe-checkout-route.ts` derives its `priceKey` zod union from
 *     {@link StripeCatalogPriceKey} so adding a new price here is the only
 *     change required to expose it at the checkout boundary.
 *
 * Durable identity in Stripe:
 *   - Products are matched by Product `metadata.catalog_product_id`
 *     (see {@link STRIPE_CATALOG_PRODUCT_METADATA_KEY}).
 *   - Prices are matched by Stripe `lookup_key`, which by convention equals
 *     this object's price key.
 *
 * Currency amounts are integer minor units (e.g. cents). PPP-tier amounts
 * approximate USD purchasing power for each region — adjust per market data,
 * not vibes.
 */
import type { PriceSpecEntry } from './catalog-sync-shared';

export const STRIPE_CATALOG_SPEC = {
  products: {
    subscription: {
      /** Value stored in Product metadata — durable identity in Stripe. */
      catalogProductId: 'subscription',
      name: 'Unlimited',
      description: 'Get unlimited access to Gamezilla servers.',
    },
  },
  prices: {
    subscription_monthly: {
      product: 'subscription',
      lookup_key: 'subscription_monthly',
      unit_amount: 700,
      currency: 'usd',
      recurring: { interval: 'month' as const },
      currency_options: {
        inr: { unit_amount: 4900 }, // India ~USD PPP $7.00
        brl: { unit_amount: 2090 }, // Brazil ~USD PPP $7.00
        ngn: { unit_amount: 6600 }, // Nigeria ~USD PPP $7.00
        zar: { unit_amount: 12900 }, // South Africa ~USD PPP $7.00
        kes: { unit_amount: 950 }, // Kenya ~USD PPP $7.00
        eur: { unit_amount: 650 }, // Europe ~USD PPP $7.00
        gbp: { unit_amount: 570 }, // UK ~USD PPP $7.00
        aud: { unit_amount: 1050 }, // Australia ~USD PPP $7.00
        cad: { unit_amount: 950 }, // Canada ~USD PPP $7.00
        mxn: { unit_amount: 119 }, // Mexico ~USD PPP $7.00
        jpy: { unit_amount: 1050 }, // Japan ~USD PPP $7.00
        sgd: { unit_amount: 930 }, // Singapore ~USD PPP $7.00
        php: { unit_amount: 390 }, // Philippines ~USD PPP $7.00
      },
    },
    subscription_yearly: {
      product: 'subscription',
      lookup_key: 'subscription_yearly',
      unit_amount: 6000,
      currency: 'usd',
      recurring: { interval: 'year' as const },
      currency_options: {
        inr: { unit_amount: 49900 }, // India ~USD PPP $60.00
        brl: { unit_amount: 20900 }, // Brazil ~USD PPP $60.00
        ngn: { unit_amount: 66000 }, // Nigeria ~USD PPP $60.00
        zar: { unit_amount: 129000 }, // South Africa ~USD PPP $60.00
        kes: { unit_amount: 9500 }, // Kenya ~USD PPP $60.00
        eur: { unit_amount: 5590 }, // Europe ~USD PPP $60.00
        gbp: { unit_amount: 4890 }, // UK ~USD PPP $60.00
        aud: { unit_amount: 8890 }, // Australia ~USD PPP $60.00
        cad: { unit_amount: 7990 }, // Canada ~USD PPP $60.00
        mxn: { unit_amount: 10190 }, // Mexico ~USD PPP $60.00
        jpy: { unit_amount: 8990 }, // Japan ~USD PPP $60.00
        sgd: { unit_amount: 7990 }, // Singapore ~USD PPP $60.00
        php: { unit_amount: 33500 }, // Philippines ~USD PPP $60.00
      },
    },
  },
} as const satisfies {
  readonly products: Record<
    string,
    {
      readonly catalogProductId: string;
      readonly name: string;
      readonly description: string;
    }
  >;
  readonly prices: Record<string, PriceSpecEntry>;
};

/** Stable identifier for a SPEC product (also used as `metadata.catalog_product_id`). */
export type StripeCatalogProductKey = keyof typeof STRIPE_CATALOG_SPEC.products;

/** Stable identifier for a SPEC price (also used as Stripe `lookup_key` and checkout `priceKey`). */
export type StripeCatalogPriceKey = keyof typeof STRIPE_CATALOG_SPEC.prices;

/** All SPEC price keys, typed as a non-empty tuple for consumers like `z.enum`. */
export const STRIPE_CATALOG_PRICE_KEYS = Object.keys(
  STRIPE_CATALOG_SPEC.prices
) as [StripeCatalogPriceKey, ...StripeCatalogPriceKey[]];
