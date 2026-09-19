/**
 * The fake provider's membership model: read the account's projection row,
 * derive the next membership for a checkout, a portal action or an `observe`
 * lifecycle event, and apply it through the shared writer.
 */
import type {
  Membership,
  MembershipChange,
  MembershipStatus,
  PlusMembershipOffer,
} from '@pkgs/billing';
import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';

import type { BillingNotify } from '../../../shared/routes/billing-route-deps';
import { applyMembershipChange } from '../../apply-subscription-state/server/apply-membership-change';
import type { MockPortalAction } from '../shared/mock-billing-contract';

export type BillingMockDeps = {
  readonly getSqlClient: () => SqlClient;
  readonly offer: PlusMembershipOffer;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly notifyUser: BillingNotify;
};

export const OBSERVE_KINDS = [
  'period_end',
  'payment_failed',
  'payment_recovered',
  'cancel_at_period_end',
  'resume',
  'cancel_now',
  'switch_interval',
  'payment_incomplete',
  'payment_expired',
] as const;

export type ObserveKind = (typeof OBSERVE_KINDS)[number];

type MembershipRow = {
  readonly provider: string;
  readonly provider_subscription_id: string;
  readonly price_key: string | null;
  readonly status: string;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

/** The account's current projection row, normalized. */
export type Current = {
  readonly provider: string;
  readonly subscriptionId: string;
  readonly offerPriceKey: string | null;
  readonly status: MembershipStatus;
  readonly periodEndMs: number | null;
  readonly endsAtPeriodEnd: boolean;
};

const MEMBERSHIP_STATUSES: Readonly<Record<string, MembershipStatus>> = {
  incomplete: 'incomplete',
  trialing: 'trialing',
  active: 'active',
  delinquent: 'delinquent',
  ended: 'ended',
};

/** Unknown persisted statuses fail closed to `ended`. */
function asMembershipStatus(value: string): MembershipStatus {
  return MEMBERSHIP_STATUSES[value] ?? 'ended';
}

const DAY_S = 24 * 60 * 60;
/** Fixed lengths so a test that advances one interval lands on the period end. */
const MONTH_S = 30 * DAY_S;
const YEAR_S = 365 * DAY_S;

function intervalSeconds(offer: PlusMembershipOffer, priceKey: string): number {
  return offer.prices[priceKey]?.interval === 'year' ? YEAR_S : MONTH_S;
}

export async function readCurrent(
  sqlClient: SqlClient,
  accountId: string
): Promise<Current | null> {
  const rows = await sqlClient.query(sql<MembershipRow>`
    SELECT provider, provider_subscription_id, price_key, status,
           current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${accountId} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1`);
  const row = rows[0];
  if (row === undefined) return null;
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    provider: row.provider,
    subscriptionId: row.provider_subscription_id,
    offerPriceKey: row.price_key,
    status: asMembershipStatus(row.status),
    periodEndMs: Number.isFinite(parsed) ? parsed : null,
    endsAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  };
}

function defaultPriceKeyOf(
  offer: PlusMembershipOffer,
  current: Current | null
): string {
  return current?.offerPriceKey ?? offer.defaultPriceKey;
}

export function currentIsLive(current: Current | null): boolean {
  return current !== null && current.status !== 'ended';
}

export type Derived = {
  readonly offerPriceKey: string | null;
  readonly membership: Membership;
  /** Set by a fresh checkout so a resubscribe lands on a new row. */
  readonly subscriptionId?: string;
};

/** Applies one derived change through the shared writer and pushes it. */
export async function applyDerived(args: {
  readonly deps: BillingMockDeps;
  readonly accountId: string;
  readonly current: Current | null;
  readonly derived: Derived;
}): Promise<MembershipChange> {
  const { deps, accountId, current, derived } = args;
  const change: MembershipChange = {
    provider: current?.provider ?? 'fake',
    customerId: `fake_cus_${accountId}`,
    subscriptionId:
      derived.subscriptionId ??
      current?.subscriptionId ??
      `fake_sub_${accountId}`,
    offerPriceKey: derived.offerPriceKey,
    membership: derived.membership,
  };
  await applyMembershipChange({
    sql: deps.getSqlClient(),
    clock: deps.clock,
    accountId,
    change,
  });
  await deps.notifyUser(accountId, 'billing:membership', [
    'billing_subscriptions',
  ]);
  return change;
}

function renewed(
  offer: PlusMembershipOffer,
  priceKey: string,
  now: number
): Membership {
  return {
    status: 'active',
    periodEndMs: now + intervalSeconds(offer, priceKey) * 1000,
    endsAtPeriodEnd: false,
  };
}

function samePeriod(
  current: Current,
  status: MembershipStatus,
  endsAtPeriodEnd: boolean
): Membership {
  return { status, periodEndMs: current.periodEndMs, endsAtPeriodEnd };
}

export function checkoutChange(args: {
  readonly deps: BillingMockDeps;
  readonly accountId: string;
  readonly current: Current | null;
  readonly priceKey: string;
}): Derived {
  const { deps, accountId, current, priceKey } = args;
  const spec = deps.offer.prices[priceKey];
  const trialDays = spec?.trialPeriodDays ?? 0;
  const now = deps.clock.now();
  const periodEndMs =
    trialDays > 0
      ? now + trialDays * DAY_S * 1000
      : now + intervalSeconds(deps.offer, priceKey) * 1000;
  return {
    offerPriceKey: priceKey,
    // A checkout after an ended membership is a new subscription, not a
    // resurrection of the old row.
    ...(current === null
      ? {}
      : { subscriptionId: `fake_sub_${accountId}_${String(now)}` }),
    membership: {
      status: trialDays > 0 ? 'trialing' : 'active',
      periodEndMs,
      endsAtPeriodEnd: false,
    },
  };
}

export function portalChange(
  deps: BillingMockDeps,
  current: Current,
  action: MockPortalAction
): Derived {
  switch (action.kind) {
    case 'cancel':
      return {
        offerPriceKey: current.offerPriceKey,
        membership: samePeriod(current, current.status, true),
      };
    case 'resume':
      return {
        offerPriceKey: current.offerPriceKey,
        membership: samePeriod(current, current.status, false),
      };
    case 'switch':
      return {
        offerPriceKey: action.priceKey,
        membership: renewed(deps.offer, action.priceKey, deps.clock.now()),
      };
  }
}

type ObserveDerivation = (args: {
  readonly deps: BillingMockDeps;
  readonly current: Current;
  readonly now: number;
  readonly priceKey: string;
}) => Derived;

/** How each `observe` kind derives the next membership from the current row. */
const OBSERVE_DERIVATIONS: Readonly<Record<ObserveKind, ObserveDerivation>> = {
  period_end: ({ deps, current, now, priceKey }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: current.endsAtPeriodEnd
      ? samePeriod(current, 'ended', true)
      : renewed(deps.offer, priceKey, now),
  }),
  payment_failed: ({ current }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: samePeriod(current, 'delinquent', current.endsAtPeriodEnd),
  }),
  payment_recovered: ({ deps, current, now, priceKey }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: renewed(deps.offer, priceKey, now),
  }),
  cancel_at_period_end: ({ current }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: samePeriod(current, current.status, true),
  }),
  resume: ({ current }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: samePeriod(current, current.status, false),
  }),
  cancel_now: ({ current, now }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: {
      status: 'ended',
      periodEndMs: now,
      endsAtPeriodEnd: false,
    },
  }),
  switch_interval: ({ deps, current, now }) => {
    const other = otherSwitchablePrice(deps.offer, current);
    if (other === undefined) {
      throw new Error('no alternative price to switch to');
    }
    return {
      offerPriceKey: other,
      membership: renewed(deps.offer, other, now),
    };
  },
  payment_incomplete: ({ current, now }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: {
      status: 'incomplete',
      periodEndMs: now,
      endsAtPeriodEnd: false,
    },
  }),
  payment_expired: ({ current, now }) => ({
    offerPriceKey: current.offerPriceKey,
    membership: {
      status: 'ended',
      periodEndMs: now,
      endsAtPeriodEnd: false,
    },
  }),
};

export function otherSwitchablePrice(
  offer: PlusMembershipOffer,
  current: Current
): string | undefined {
  return offer.switchablePriceKeys.find((key) => key !== current.offerPriceKey);
}

/** The lifecycle driver: derive the next membership from the current row. */
export function observeChange(
  deps: BillingMockDeps,
  current: Current,
  kind: ObserveKind
): Derived {
  return OBSERVE_DERIVATIONS[kind]({
    deps,
    current,
    now: deps.clock.now(),
    priceKey: defaultPriceKeyOf(deps.offer, current),
  });
}
