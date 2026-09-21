/**
 * The Stripe adapter against the shared membership contract. The real Stripe
 * SDK runs end to end — request encoding, response parsing, webhook signature
 * verification — over a fake Stripe REST origin that answers from memory.
 */
import {
  CONTRACT_ENDED_AT_MS,
  CONTRACT_NOW_MS,
  CONTRACT_OFFER,
  CONTRACT_PERIOD_END_MS,
  type ContractSignature,
  type ContractSituation,
  type ContractSubscription,
  describeMembershipBillingContract,
  type MembershipBillingContractHarness,
} from '@pkgs/billing/membership-billing-contract';
import Stripe from 'stripe';

import { createStripeMembershipBilling } from './stripe-membership';

const ORIGIN = 'http://stripe.contract:12111';
const WEBHOOK_SECRET = 'whsec_contract';

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

function stripeSubscription(subscription: ContractSubscription) {
  const lookupKey =
    subscription.priceKey === null
      ? 'legacy_price'
      : (CONTRACT_OFFER.prices[subscription.priceKey]?.lookupKey ?? null);
  return {
    id: subscription.id,
    object: 'subscription',
    customer: subscription.customerId,
    status: STRIPE_STATUS[subscription.situation],
    cancel_at_period_end: subscription.situation === 'canceling',
    ended_at: endedAtS(subscription.situation),
    items: {
      object: 'list',
      data: [
        {
          id: 'si_contract',
          current_period_end: CONTRACT_PERIOD_END_MS / 1000,
          price: { id: `price_${String(lookupKey)}`, lookup_key: lookupKey },
        },
      ],
    },
  };
}

class FakeStripe {
  readonly subscriptions = new Map<string, ContractSubscription>();
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${String(this.seq)}`;
  }

  private route(method: string, url: URL): unknown {
    const path = url.pathname;
    if (method === 'POST' && path === '/v1/customers') {
      return { id: this.nextId('cus'), object: 'customer' };
    }
    if (method === 'GET' && path === '/v1/prices') {
      const key = url.searchParams.get('lookup_keys[0]') ?? '';
      return {
        object: 'list',
        data: [{ id: `price_${key}`, lookup_key: key }],
      };
    }
    if (method === 'POST' && path === '/v1/checkout/sessions') {
      const id = this.nextId('cs_test');
      return { id, url: `https://checkout.stripe.test/c/pay/${id}` };
    }
    if (method === 'POST' && path === '/v1/billing_portal/sessions') {
      const id = this.nextId('bps');
      return { id, url: `https://billing.stripe.test/p/session/${id}` };
    }
    const subscription = this.subscriptions.get(
      path.replace('/v1/subscriptions/', '')
    );
    if (method === 'GET' && subscription !== undefined) {
      return stripeSubscription(subscription);
    }
    return null;
  }

  fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const body = this.route(init?.method ?? 'GET', url);
    return Promise.resolve(
      body === null
        ? Response.json(
            {
              error: {
                type: 'invalid_request_error',
                code: 'resource_missing',
              },
            },
            { status: 404 }
          )
        : Response.json(body)
    );
  };
}

const EVENT_TYPE = {
  subscription_changed: 'customer.subscription.updated',
  subscription_ended: 'customer.subscription.deleted',
  unrelated: 'invoice.paid',
} as const;

async function signedHeaders(
  signature: ContractSignature,
  payload: string
): Promise<Headers> {
  if (signature === 'missing') return new Headers();
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: signature === 'tampered' ? `${payload} ` : payload,
    secret: signature === 'wrong_secret' ? 'whsec_other' : WEBHOOK_SECRET,
    timestamp: Math.floor(
      (signature === 'stale' ? CONTRACT_NOW_MS - 3_600_000 : CONTRACT_NOW_MS) /
        1000
    ),
  });
  return new Headers({ 'stripe-signature': header });
}

function openStripeHarness(): Promise<MembershipBillingContractHarness> {
  const stripe = new FakeStripe();
  return Promise.resolve({
    provider: 'stripe',
    billing: createStripeMembershipBilling({
      secretKey: 'sk_test_contract',
      webhookSecret: WEBHOOK_SECRET,
      offer: CONTRACT_OFFER,
      now: () => CONTRACT_NOW_MS,
      transport: { origin: ORIGIN, fetch: stripe.fetch },
    }),
    setSubscription: (subscription) => {
      stripe.subscriptions.set(subscription.id, subscription);
    },
    callback: async ({ subscriptionId, kind, signature }) => {
      const current = stripe.subscriptions.get(subscriptionId);
      const rawBody = JSON.stringify({
        id: 'evt_contract',
        object: 'event',
        type: EVENT_TYPE[kind],
        data: {
          object:
            current === undefined
              ? { id: subscriptionId }
              : stripeSubscription(current),
        },
      });
      return { headers: await signedHeaders(signature, rawBody), rawBody };
    },
  });
}

describeMembershipBillingContract('StripeMembershipBilling', openStripeHarness);
