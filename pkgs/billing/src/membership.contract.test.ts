// goal:room-to-grow:4
/**
 * The contract is provider-agnostic: a third, made-up provider with its own
 * vocabulary, ids and signature scheme passes the same suite Stripe and the
 * mock provider run. Nothing in the port knows about any of them.
 */

import type {
  CallbackResult,
  MembershipBilling,
  MembershipStatus,
  OpenPortalInput,
  ReadCallbackInput,
  StartCheckoutInput,
  StartCheckoutResult,
} from './membership';
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
} from './membership-billing-contract';

/** The other provider's own words for a plan's state. */
type Phase =
  | 'trial'
  | 'paid'
  | 'stopping'
  | 'dunning'
  | 'lapsed'
  | 'over'
  | 'cut_short'
  | 'pending'
  | 'abandoned'
  | 'frozen';

const PHASE_OF: Readonly<Record<ContractSituation, Phase>> = {
  trialing: 'trial',
  active: 'paid',
  canceling: 'stopping',
  renewal_failed: 'dunning',
  retries_exhausted: 'lapsed',
  ended_at_period_end: 'over',
  canceled_immediately: 'cut_short',
  first_payment_incomplete: 'pending',
  first_payment_expired: 'abandoned',
  paused: 'frozen',
};

const STATUS_OF: Readonly<Record<Phase, MembershipStatus>> = {
  trial: 'trialing',
  paid: 'active',
  stopping: 'active',
  dunning: 'delinquent',
  lapsed: 'ended',
  over: 'ended',
  cut_short: 'ended',
  pending: 'incomplete',
  abandoned: 'ended',
  frozen: 'ended',
};

type Plan = {
  readonly ref: string;
  readonly holder: string;
  readonly phase: Phase;
  readonly sku: string;
  readonly paidThrough: number;
  readonly stoppedAt: number | null;
};

const SECRET = 'other-secret';

function sign(secret: string, t: number, body: string): string {
  const hasher = new Bun.CryptoHasher('sha256', secret);
  hasher.update(`${String(t)}:${body}`);
  return hasher.digest('hex');
}

type OtherProvider = {
  readonly plans: Map<string, Plan>;
  newHolder(): string;
};

function openOtherProvider(): OtherProvider {
  let holders = 0;
  return {
    plans: new Map(),
    newHolder: () => {
      holders += 1;
      return `holder-${String(holders)}`;
    },
  };
}

class OtherProviderBilling implements MembershipBilling {
  constructor(private readonly provider: OtherProvider) {}

  startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
    const customerId = input.customerId ?? this.provider.newHolder();
    return Promise.resolve({
      customerId,
      url: `https://other.test/pay?holder=${customerId}`,
    });
  }

  openPortal(input: OpenPortalInput): Promise<{ readonly url: string }> {
    return Promise.resolve({
      url: `https://other.test/manage?holder=${input.customerId}`,
    });
  }

  readCallback(input: ReadCallbackInput): Promise<CallbackResult> {
    const header = input.headers.get('x-other-signature');
    const [t, digest] = header?.split('.') ?? [];
    const sentAt = Number(t);
    if (
      digest === undefined ||
      !Number.isFinite(sentAt) ||
      Math.abs(CONTRACT_NOW_MS - sentAt) > 300_000 ||
      digest !== sign(SECRET, sentAt, input.rawBody)
    ) {
      return Promise.resolve({ kind: 'unverified' });
    }
    const event = JSON.parse(input.rawBody) as { topic: string; ref: string };
    if (!event.topic.startsWith('plan.')) {
      return Promise.resolve({ kind: 'ignored' });
    }
    const plan = this.provider.plans.get(event.ref);
    if (plan === undefined) return Promise.resolve({ kind: 'ignored' });
    const offerKey = Object.values(CONTRACT_OFFER.prices).find(
      (price) => price.lookupKey === plan.sku
    )?.key;
    return Promise.resolve({
      kind: 'membership',
      provider: 'other',
      customerId: plan.holder,
      subscriptionId: plan.ref,
      offerPriceKey: offerKey ?? null,
      membership: {
        status: STATUS_OF[plan.phase],
        periodEndMs: plan.stoppedAt ?? plan.paidThrough,
        endsAtPeriodEnd: plan.phase === 'stopping',
      },
    });
  }
}

function signatureHeader(signature: ContractSignature, body: string): Headers {
  const t =
    signature === 'stale' ? CONTRACT_NOW_MS - 3_600_000 : CONTRACT_NOW_MS;
  const secret = signature === 'wrong_secret' ? 'nope' : SECRET;
  const signed = signature === 'tampered' ? `${body} ` : body;
  return signature === 'missing'
    ? new Headers()
    : new Headers({
        'x-other-signature': `${String(t)}.${sign(secret, t, signed)}`,
      });
}

function planOf(subscription: ContractSubscription): Plan {
  const phase = PHASE_OF[subscription.situation];
  return {
    ref: subscription.id,
    holder: subscription.customerId,
    phase,
    sku:
      subscription.priceKey === null
        ? 'legacy_sku'
        : (CONTRACT_OFFER.prices[subscription.priceKey]?.lookupKey ?? ''),
    paidThrough: CONTRACT_PERIOD_END_MS,
    stoppedAt: phase === 'cut_short' ? CONTRACT_ENDED_AT_MS : null,
  };
}

function openOtherHarness(): Promise<MembershipBillingContractHarness> {
  const provider = openOtherProvider();
  return Promise.resolve({
    provider: 'other',
    billing: new OtherProviderBilling(provider),
    setSubscription: (subscription) => {
      provider.plans.set(subscription.id, planOf(subscription));
    },
    callback: ({ subscriptionId, kind, signature }) => {
      const topic = kind === 'unrelated' ? 'receipt.sent' : `plan.${kind}`;
      const rawBody = JSON.stringify({ topic, ref: subscriptionId });
      return Promise.resolve({
        headers: signatureHeader(signature, rawBody),
        rawBody,
      });
    },
  });
}

describeMembershipBillingContract('a made-up provider', openOtherHarness);
