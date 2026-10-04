/**
 * The Paddle adapter against the shared membership contract, over the fake
 * Paddle REST origin (`@pkgs/billing-paddle/harness`): request encoding, the
 * envelope, error codes and Paddle's webhook signatures, end to end.
 */
import { CONTRACT_ENDED_AT_MS, CONTRACT_NOW_MS, CONTRACT_OFFER, CONTRACT_PERIOD_END_MS } from '@pkgs/billing-shared/contract-fixtures';
import type { ContractCallbackKind, ContractSubscription, MembershipBillingContractHarness } from '@pkgs/billing-shared/membership-billing-contract';
import type { ContractSituation } from '@pkgs/billing-shared/contract-fixtures';
import { describeMembershipBillingContract } from '@pkgs/billing-shared/membership-billing-contract';
import { PaddleMembershipBilling } from '@pkgs/billing-paddle-shared/paddle-membership';
import { FakePaddle } from '@pkgs/billing-paddle-harness/fake-paddle';
import type { FakePaddleSubscription } from '@pkgs/billing-paddle-harness/fake-paddle';

type Shape = Omit<
  FakePaddleSubscription,
  'id' | 'customerId' | 'catalogPriceId'
>;

const LIVE = {
  periodEndMs: CONTRACT_PERIOD_END_MS,
  scheduledChange: null,
  canceledAtMs: null,
  pausedAtMs: null,
} as const;

/**
 * Paddle clears the billing period once a subscription is paused or
 * canceled, and says when it stopped instead.
 */
const PADDLE_SHAPE: Readonly<
  Record<
    Exclude<
      ContractSituation,
      'first_payment_incomplete' | 'first_payment_expired'
    >,
    Shape
  >
> = {
  trialing: { ...LIVE, status: 'trialing' },
  active: { ...LIVE, status: 'active' },
  canceling: { ...LIVE, status: 'active', scheduledChange: 'cancel' },
  renewal_failed: { ...LIVE, status: 'past_due' },
  // Paddle cancels a subscription whose dunning runs out.
  retries_exhausted: {
    ...LIVE,
    status: 'canceled',
    periodEndMs: null,
    canceledAtMs: CONTRACT_PERIOD_END_MS,
  },
  ended_at_period_end: {
    ...LIVE,
    status: 'canceled',
    periodEndMs: null,
    canceledAtMs: CONTRACT_PERIOD_END_MS,
  },
  canceled_immediately: {
    ...LIVE,
    status: 'canceled',
    periodEndMs: null,
    canceledAtMs: CONTRACT_ENDED_AT_MS,
  },
  paused: {
    ...LIVE,
    status: 'paused',
    periodEndMs: null,
    pausedAtMs: CONTRACT_PERIOD_END_MS,
  },
};

const NO_FIRST_PAYMENT =
  'Paddle creates a subscription only once its first payment settles';

function paddleSubscription(
  subscription: ContractSubscription
): FakePaddleSubscription {
  const situation = subscription.situation;
  if (
    situation === 'first_payment_incomplete' ||
    situation === 'first_payment_expired'
  ) {
    throw new Error(`${situation} cannot arise at Paddle`);
  }
  return {
    ...PADDLE_SHAPE[situation],
    id: subscription.id,
    customerId: subscription.customerId,
    catalogPriceId:
      subscription.priceKey === null
        ? 'legacy_price'
        : (CONTRACT_OFFER.prices[subscription.priceKey]?.catalogPriceId ??
          null),
  };
}

const EVENT_TYPE: Readonly<Record<ContractCallbackKind, string>> = {
  subscription_changed: 'subscription.updated',
  subscription_ended: 'subscription.canceled',
  subscription_paused: 'subscription.paused',
  subscription_resumed: 'subscription.resumed',
  unrelated: 'customer.updated',
};

function openPaddleHarness(): Promise<MembershipBillingContractHarness> {
  const paddle = new FakePaddle();
  for (const spec of Object.values(CONTRACT_OFFER.prices)) {
    paddle.seedPrice(spec.catalogPriceId);
  }
  return Promise.resolve({
    billing: new PaddleMembershipBilling({
      apiKey: paddle.apiKey,
      webhookSecret: paddle.webhookSecret,
      offer: CONTRACT_OFFER,
      now: () => CONTRACT_NOW_MS,
      fetch: paddle.fetch,
      origin: paddle.origin,
    }),
    setSubscription: (subscription) => {
      paddle.setSubscription(paddleSubscription(subscription));
    },
    setUnavailable: (unavailable) => {
      paddle.down = unavailable;
    },
    callback: ({ subscriptionId, kind, signature }) => {
      const delivery = paddle.webhook({
        eventType: EVENT_TYPE[kind],
        subscriptionId,
        timestampS: Math.floor(
          (signature === 'stale'
            ? CONTRACT_NOW_MS - 3_600_000
            : CONTRACT_NOW_MS) / 1000
        ),
        tamper: signature === 'tampered',
        ...(signature === 'wrong_secret' ? { secret: 'pdl_ntfset_other' } : {}),
      });
      return Promise.resolve(
        signature === 'missing'
          ? { headers: new Headers(), rawBody: delivery.rawBody }
          : delivery
      );
    },
  });
}

describeMembershipBillingContract(
  'PaddleMembershipBilling',
  openPaddleHarness,
  {
    unreachable: {
      first_payment_incomplete: NO_FIRST_PAYMENT,
      first_payment_expired: NO_FIRST_PAYMENT,
    },
  }
);
