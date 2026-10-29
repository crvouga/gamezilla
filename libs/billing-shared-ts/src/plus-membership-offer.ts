/**
 * The plus membership offer — source of truth for what we sell and how the
 * hosted portal is configured. Reconciled onto every configured provider in
 * `billing:sync`, on deploy only; the package's tests validate this value in
 * the PR gate without touching any provider.
 *
 * Currency amounts are integer minor units (e.g. cents). PPP-tier amounts
 * approximate USD purchasing power for each region.
 */
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import type {
  OfferPriceSpec,
  PlusMembershipOffer,
} from '@pkgs/billing-root-shared-ts/offer';

export const PLUS_MEMBERSHIP_OFFER = {
  product: {
    catalogProductId: 'subscription',
    name: 'Unlimited',
    description: `Get unlimited access to ${PRODUCT_NAME} servers.`,
  },
  prices: {
    subscription_monthly: {
      key: 'subscription_monthly',
      catalogPriceId: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 7,
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
      key: 'subscription_yearly',
      catalogPriceId: 'subscription_yearly',
      unitAmount: 6000,
      currency: 'usd',
      interval: 'year',
      trialPeriodDays: 7,
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
  defaultPriceKey: 'subscription_monthly',
  switchablePriceKeys: ['subscription_monthly', 'subscription_yearly'],
  portal: {
    defaultReturnUrlPath: '/more/billing',
    businessProfileHeadline: `${PRODUCT_NAME} Unlimited`,
    cancellationReasons: ['too_expensive', 'missing_features', 'other'],
  },
  callbackPath: '/api/billing/callback',
  callbackDescription: `${PRODUCT_NAME} plus membership projection`,
} as const satisfies PlusMembershipOffer & {
  readonly prices: Record<string, OfferPriceSpec>;
};

export type OfferPriceKey = keyof typeof PLUS_MEMBERSHIP_OFFER.prices;
