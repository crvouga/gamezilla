/**
 * The Stripe adapter against the shared membership contract. The real Stripe
 * SDK runs end to end — request encoding, response parsing, webhook signature
 * verification — over the fake Stripe REST origin (`@pkgs/billing-stripe/sim`).
 */
import {
  CONTRACT_ENDED_AT_MS,
  CONTRACT_NOW_MS,
  CONTRACT_OFFER,
  CONTRACT_PERIOD_END_MS,
  type ContractCallbackKind,
  type ContractSituation,
  type ContractSubscription,
  describeMembershipBillingContract,
  type MembershipBillingContractHarness,
} from '@pkgs/billing/membership-billing-contract';

import { FakeStripe, type FakeStripeSubscription } from './sim';
import { createStripeMembershipBilling } from './stripe-membership';

const STRIPE_STATUS: Readonly<Record<ContractSituation, string>> = {
  trialing: 'trialing',
  active: 'active',
  canceling: 'active',
  renewal_failed: 'past_due',
  retries_exhausted: 'unpaid',
  ended_at_period_end: 'canceled',
  canceled_immediately: 'canceled',
  first_payment_incomplete: 'incomplete',
  first_payment_expired: 'incomplete_expired',
  paused: 'paused',
};

function endedAtS(situation: ContractSituation): number | null {
  if (situation === 'ended_at_period_end') return CONTRACT_PERIOD_END_MS / 1000;
  if (situation === 'canceled_immediately') return CONTRACT_ENDED_AT_MS / 1000;
  return null;
}

function stripeSubscription(
  subscription: ContractSubscription
): FakeStripeSubscription {
  return {
    id: subscription.id,
    customer: subscription.customerId,
    status: STRIPE_STATUS[subscription.situation],
    cancelAtPeriodEnd: subscription.situation === 'canceling',
    currentPeriodEndS: CONTRACT_PERIOD_END_MS / 1000,
    endedAtS: endedAtS(subscription.situation),
    lookupKey:
      subscription.priceKey === null
        ? 'legacy_price'
        : (CONTRACT_OFFER.prices[subscription.priceKey]?.catalogPriceId ??
          null),
  };
}

const EVENT_TYPE: Readonly<Record<ContractCallbackKind, string>> = {
  subscription_changed: 'customer.subscription.updated',
  subscription_ended: 'customer.subscription.deleted',
  subscription_paused: 'customer.subscription.paused',
  subscription_resumed: 'customer.subscription.resumed',
  unrelated: 'invoice.paid',
};

function openStripeHarness(): Promise<MembershipBillingContractHarness> {
  const stripe = new FakeStripe();
  return Promise.resolve({
    billing: createStripeMembershipBilling({
      secretKey: 'sk_test_contract',
      webhookSecret: stripe.webhookSecret,
      offer: CONTRACT_OFFER,
      now: () => CONTRACT_NOW_MS,
      transport: { origin: stripe.origin, fetch: stripe.fetch },
    }),
    setSubscription: (subscription) => {
      stripe.setSubscription(stripeSubscription(subscription));
    },
    setUnavailable: (unavailable) => {
      stripe.down = unavailable;
    },
    callback: async ({ subscriptionId, kind, signature }) => {
      const delivery = await stripe.webhook({
        type: EVENT_TYPE[kind],
        subscriptionId,
        timestampS: Math.floor(
          (signature === 'stale'
            ? CONTRACT_NOW_MS - 3_600_000
            : CONTRACT_NOW_MS) / 1000
        ),
        tamper: signature === 'tampered',
        ...(signature === 'wrong_secret' ? { secret: 'whsec_other' } : {}),
      });
      return signature === 'missing'
        ? { headers: new Headers(), rawBody: delivery.rawBody }
        : delivery;
    },
  });
}

describeMembershipBillingContract('StripeMembershipBilling', openStripeHarness);
