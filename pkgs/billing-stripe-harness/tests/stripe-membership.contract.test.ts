/**
 * The Stripe adapter against the shared membership contract. The real Stripe
 * SDK runs end to end — request encoding, response parsing, webhook signature
 * verification — against Stripe in test mode, simulated
 * (`@pkgs/billing-stripe/harness`).
 */

import type { ContractSituation } from '@pkgs/billing-shared/contract-fixtures';
import {
  CONTRACT_ENDED_AT_MS,
  CONTRACT_NOW_MS,
  CONTRACT_OFFER,
  CONTRACT_PERIOD_END_MS,
} from '@pkgs/billing-shared/contract-fixtures';
import type {
  ContractCallbackKind,
  ContractSubscription,
  MembershipBillingContractHarness,
} from '@pkgs/billing-shared/membership-billing-contract';
import { describeMembershipBillingContract } from '@pkgs/billing-shared/membership-billing-contract';

import type { PinnedSubscription } from '@pkgs/billing-stripe-harness/stripe-test-mode';
import { StripeTestMode } from '@pkgs/billing-stripe-harness/stripe-test-mode';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe-server/stripe-membership';

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
): PinnedSubscription {
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
          'legacy_price'),
  };
}

const EVENT_TYPE: Readonly<Record<ContractCallbackKind, string>> = {
  subscription_changed: 'customer.subscription.updated',
  subscription_ended: 'customer.subscription.deleted',
  subscription_paused: 'customer.subscription.paused',
  subscription_resumed: 'customer.subscription.resumed',
  unrelated: 'invoice.paid',
};

async function openStripeHarness(): Promise<MembershipBillingContractHarness> {
  const stripe = new StripeTestMode({ nowMs: CONTRACT_NOW_MS });
  await stripe.seedPrices(
    Object.values(CONTRACT_OFFER.prices).map((spec) => spec.catalogPriceId)
  );
  let pinned: Promise<void> = Promise.resolve();
  return {
    billing: createStripeMembershipBilling({
      secretKey: stripe.secretKey,
      webhookSecret: stripe.webhookSecret,
      offer: CONTRACT_OFFER,
      now: () => CONTRACT_NOW_MS,
      transport: {
        origin: stripe.origin,
        // The adapter reads the subscription as last pinned.
        fetch: async (input, init) => {
          await pinned;
          return await stripe.fetch(input, init);
        },
      },
    }),
    setSubscription: (subscription) => {
      pinned = stripe.putSubscription(stripeSubscription(subscription));
    },
    setUnavailable: (unavailable) => {
      stripe.down = unavailable;
    },
    callback: async ({ subscriptionId, kind, signature }) => {
      await pinned;
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
  };
}

describeMembershipBillingContract('StripeMembershipBilling', openStripeHarness);
