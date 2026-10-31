/**
 * The provider-neutral situations the membership contract covers, and what
 * every adapter must report for each. A harness translates a situation into
 * its own provider's object; the expectation is the same for all of them.
 */
import type { Membership, MembershipStatus } from './membership';
import type { PlusMembershipOffer } from './offer';

/** A fixed epoch the harnesses sign callbacks against. */
export const CONTRACT_NOW_MS = 1_800_000_000_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the contract's subscriptions put their period end. */
export const CONTRACT_PERIOD_END_MS = CONTRACT_NOW_MS + 7 * DAY_MS;

/** When an immediately-canceled subscription ended (before its period end). */
export const CONTRACT_ENDED_AT_MS = CONTRACT_NOW_MS - DAY_MS;

/**
 * A subscription's life, in words every provider has: a harness maps each one
 * onto its own status names and fields.
 */
export type ContractSituation =
  | 'trialing' // inside the free trial
  | 'active' // paid and current
  | 'canceling' // paid, set to stop at the period end
  | 'renewal_failed' // a renewal charge failed; the provider keeps retrying
  | 'retries_exhausted' // every retry failed; left unpaid
  | 'ended_at_period_end' // stopped when the paid period ran out
  | 'canceled_immediately' // stopped before the period end
  | 'first_payment_incomplete' // the first charge has not settled
  | 'first_payment_expired' // the first charge never settled
  | 'paused'; // paused by the provider (e.g. a trial ended without a card)

export const CONTRACT_SITUATIONS: readonly ContractSituation[] = [
  'trialing',
  'active',
  'canceling',
  'renewal_failed',
  'retries_exhausted',
  'ended_at_period_end',
  'canceled_immediately',
  'first_payment_incomplete',
  'first_payment_expired',
  'paused',
];

function membership(
  status: MembershipStatus,
  periodEndMs: number,
  endsAtPeriodEnd = false
): Membership {
  return { status, periodEndMs, endsAtPeriodEnd };
}

/** What every adapter must report for each situation. */
export const CONTRACT_EXPECTED: Readonly<
  Record<ContractSituation, Membership>
> = {
  trialing: membership('trialing', CONTRACT_PERIOD_END_MS),
  active: membership('active', CONTRACT_PERIOD_END_MS),
  canceling: membership('active', CONTRACT_PERIOD_END_MS, true),
  renewal_failed: membership('delinquent', CONTRACT_PERIOD_END_MS),
  retries_exhausted: membership('ended', CONTRACT_PERIOD_END_MS),
  ended_at_period_end: membership('ended', CONTRACT_PERIOD_END_MS),
  // Access stops when the subscription stopped, not at the period it lost.
  canceled_immediately: membership('ended', CONTRACT_ENDED_AT_MS),
  first_payment_incomplete: membership('incomplete', CONTRACT_PERIOD_END_MS),
  first_payment_expired: membership('ended', CONTRACT_PERIOD_END_MS),
  paused: membership('ended', CONTRACT_PERIOD_END_MS),
};

/** The offer every harness configures its adapter with. */
export const CONTRACT_OFFER: PlusMembershipOffer = {
  product: {
    catalogProductId: 'subscription',
    name: 'Unlimited',
    description: 'Contract product',
  },
  prices: {
    subscription_monthly: {
      key: 'subscription_monthly',
      catalogPriceId: 'subscription_monthly',
      unitAmount: 700,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 7,
      currencyOptions: {},
    },
    subscription_yearly: {
      key: 'subscription_yearly',
      catalogPriceId: 'subscription_yearly',
      unitAmount: 6000,
      currency: 'usd',
      interval: 'year',
      trialPeriodDays: 7,
      currencyOptions: {},
    },
  },
  defaultPriceKey: 'subscription_monthly',
  switchablePriceKeys: ['subscription_monthly', 'subscription_yearly'],
  portal: {
    defaultReturnUrlPath: '/more/billing',
    businessProfileHeadline: 'Contract Unlimited',
    cancellationReasons: ['too_expensive', 'other'],
  },
  callbackPath: '/api/billing/callback',
  callbackDescription: 'Contract membership callbacks',
};
