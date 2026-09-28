/**
 * The mock adapter against the shared membership contract, over a fake of the
 * mock wire that answers from memory — the same shape of harness Stripe's
 * adapter runs under. The real provider is exercised end to end by
 * `@pkgs/billing-mock-provider` and the billing spec suites.
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

import { MockMembershipBilling } from './mock-membership-billing';
import { signMockBillingPayload } from './signature';
import {
  MOCK_BILLING_SIGNATURE_HEADER,
  type MockSubscription,
  type MockSubscriptionStatus,
} from './wire';

const ORIGIN = 'http://billing.contract';
const SECRET_KEY = 'sk_test_mock_contract';
const WEBHOOK_SECRET = 'whsec_mock_contract';

const STATUS: Readonly<Record<ContractSituation, MockSubscriptionStatus>> = {
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

const PERIOD_END_S = CONTRACT_PERIOD_END_MS / 1000;

function endedAt(situation: ContractSituation): number | null {
  if (situation === 'ended_at_period_end') return PERIOD_END_S;
  if (situation === 'canceled_immediately') return CONTRACT_ENDED_AT_MS / 1000;
  return null;
}

function wireSubscription(
  subscription: ContractSubscription
): MockSubscription {
  const catalogPriceId =
    subscription.priceKey === null
      ? 'legacy_price'
      : (CONTRACT_OFFER.prices[subscription.priceKey]?.catalogPriceId ?? null);
  const price = {
    id: `price_${String(catalogPriceId)}`,
    object: 'price' as const,
    active: true,
    product: 'prod_subscription',
    lookup_key: catalogPriceId,
    nickname: null,
    unit_amount: 700,
    currency: 'usd',
    recurring: {
      interval: 'month' as const,
      interval_count: 1 as const,
      trial_period_days: null,
    },
    created: 0,
  };
  return {
    id: subscription.id,
    object: 'subscription',
    customer: subscription.customerId,
    status: STATUS[subscription.situation],
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [
        {
          id: 'si_contract',
          object: 'subscription_item',
          price,
          quantity: 1,
          current_period_start: PERIOD_END_S - 30 * 86_400,
          current_period_end: PERIOD_END_S,
        },
      ],
    },
    cancel_at_period_end: subscription.situation === 'canceling',
    cancel_at: null,
    canceled_at: endedAt(subscription.situation),
    ended_at: endedAt(subscription.situation),
    cancellation_details: { reason: null, feedback: null, comment: null },
    trial_start: null,
    trial_end: null,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    start_date: 0,
    created: 0,
    livemode: false,
    latest_invoice: null,
    default_payment_method: null,
    metadata: {},
  };
}

class FakeProvider {
  readonly subscriptions = new Map<string, ContractSubscription>();
  private seq = 0;
  down = false;

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
      const key = url.searchParams.get('lookup_keys') ?? '';
      return {
        object: 'list',
        data: [{ id: `price_${key}`, lookup_key: key }],
      };
    }
    if (method === 'POST' && path === '/v1/checkout/sessions') {
      const id = this.nextId('cs_test');
      return { id, url: `${ORIGIN}/c/pay/${id}` };
    }
    if (method === 'POST' && path === '/v1/billing_portal/sessions') {
      const id = this.nextId('bps');
      return { id, url: `${ORIGIN}/p/session/${id}` };
    }
    const subscription = this.subscriptions.get(
      path.replace('/v1/subscriptions/', '')
    );
    return method === 'GET' && subscription !== undefined
      ? wireSubscription(subscription)
      : null;
  }

  fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const authorized =
      new Headers(init?.headers).get('authorization') ===
      `Bearer ${SECRET_KEY}`;
    if (!authorized) return Promise.resolve(Response.json({}, { status: 401 }));
    if (this.down) {
      return Promise.resolve(
        Response.json(
          { error: { type: 'api_error', message: 'Provider unavailable' } },
          { status: 500 }
        )
      );
    }
    const body = this.route(init?.method ?? 'GET', url);
    return Promise.resolve(
      body === null
        ? Response.json(
            {
              error: {
                type: 'invalid_request_error',
                message: 'No such object',
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
  subscription_paused: 'customer.subscription.paused',
  subscription_resumed: 'customer.subscription.resumed',
  unrelated: 'invoice.paid',
} as const;

function signedHeaders(signature: ContractSignature, payload: string): Headers {
  if (signature === 'missing') return new Headers();
  const timestampMs =
    signature === 'stale' ? CONTRACT_NOW_MS - 3_600_000 : CONTRACT_NOW_MS;
  return new Headers({
    [MOCK_BILLING_SIGNATURE_HEADER]: signMockBillingPayload({
      secret: signature === 'wrong_secret' ? 'whsec_other' : WEBHOOK_SECRET,
      payload: signature === 'tampered' ? `${payload} ` : payload,
      timestampS: Math.floor(timestampMs / 1000),
    }),
  });
}

function openMockHarness(): Promise<MembershipBillingContractHarness> {
  const provider = new FakeProvider();
  return Promise.resolve({
    billing: new MockMembershipBilling({
      origin: ORIGIN,
      secretKey: SECRET_KEY,
      webhookSecret: WEBHOOK_SECRET,
      offer: CONTRACT_OFFER,
      now: () => CONTRACT_NOW_MS,
      fetch: provider.fetch,
    }),
    setSubscription: (subscription) => {
      provider.subscriptions.set(subscription.id, subscription);
    },
    setUnavailable: (unavailable) => {
      provider.down = unavailable;
    },
    callback: ({ subscriptionId, kind, signature }) => {
      const current = provider.subscriptions.get(subscriptionId);
      const rawBody = JSON.stringify({
        id: 'evt_contract',
        object: 'event',
        type: EVENT_TYPE[kind],
        created: CONTRACT_NOW_MS / 1000,
        livemode: false,
        data: {
          object:
            current === undefined
              ? { id: subscriptionId }
              : wireSubscription(current),
        },
      });
      return Promise.resolve({
        headers: signedHeaders(signature, rawBody),
        rawBody,
      });
    },
  });
}

describeMembershipBillingContract('MockMembershipBilling', openMockHarness);
