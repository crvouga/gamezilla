/**
 * Every mock subscription the adapter can read, projected through
 * `MockMembershipBilling`: status × cancel flag × `ended_at` × price × event
 * type. The tables are the Stripe adapter's (`@pkgs/billing-stripe`
 * `tests/membership-mapping.test.ts`) — the two providers speak one lifecycle,
 * so they must project it identically.
 */
import { describe, expect, test } from 'bun:test';
import type { CallbackResult, MembershipStatus } from '@pkgs/billing';
import { CONTRACT_OFFER } from '@pkgs/billing/membership-billing-contract';
import {
  MOCK_BILLING_SIGNATURE_HEADER,
  MockMembershipBilling,
  signMockBillingPayload,
} from '@pkgs/billing-mock';

const NOW_MS = 1_800_000_000_000;
const PERIOD_END_S = NOW_MS / 1000 + 7 * 86_400;
const ENDED_EARLY_S = NOW_MS / 1000 - 86_400;
const WEBHOOK_SECRET = 'whsec_matrix';

const STATUS: ReadonlyArray<readonly [string, MembershipStatus]> = [
  ['incomplete', 'incomplete'],
  ['incomplete_expired', 'ended'],
  ['trialing', 'trialing'],
  ['active', 'active'],
  ['past_due', 'delinquent'],
  ['canceled', 'ended'],
  ['unpaid', 'ended'],
  ['paused', 'ended'],
  ['some_future_status', 'ended'],
];

const ENDED_AT: ReadonlyArray<readonly [string, number | null, number]> = [
  ['none', null, PERIOD_END_S * 1000],
  ['before the period end', ENDED_EARLY_S, ENDED_EARLY_S * 1000],
  ['at the period end', PERIOD_END_S, PERIOD_END_S * 1000],
];

const PRICES: ReadonlyArray<readonly [string | null, string | null]> = [
  ['subscription_monthly', 'subscription_monthly'],
  ['subscription_yearly', 'subscription_yearly'],
  ['legacy_price', null],
  [null, null],
];

/**
 * The provider only emits `customer.subscription.deleted` for a subscription
 * that is already `canceled`, so the deleted rows here are canceled ones.
 */
const EVENTS: ReadonlyArray<readonly [string, 'project' | 'ignore']> = [
  ['customer.subscription.created', 'project'],
  ['customer.subscription.updated', 'project'],
  ['customer.subscription.deleted', 'project'],
  ['customer.subscription.trial_will_end', 'ignore'],
  ['invoice.payment_failed', 'ignore'],
  ['invoice.paid', 'ignore'],
  ['checkout.session.completed', 'ignore'],
  ['customer.created', 'ignore'],
];

type Case = {
  readonly status: (typeof STATUS)[number];
  readonly cancel: boolean;
  readonly endedAt: (typeof ENDED_AT)[number];
  readonly price: (typeof PRICES)[number];
  readonly event: (typeof EVENTS)[number];
};

/** Every element of `rows` extended with every value of `values`. */
function times<T, K extends string, V>(
  rows: readonly T[],
  key: K,
  values: readonly V[]
): (T & Record<K, V>)[] {
  return rows.flatMap((row) =>
    values.map((value) => ({ ...row, [key]: value }) as T & Record<K, V>)
  );
}

function cases(): readonly Case[] {
  let rows: readonly object[] = [{}];
  rows = times(rows, 'status', STATUS);
  rows = times(rows, 'cancel', [false, true]);
  rows = times(rows, 'endedAt', ENDED_AT);
  rows = times(rows, 'price', PRICES);
  rows = times(rows, 'event', EVENTS);
  return (rows as readonly Case[]).filter(
    (c) =>
      c.event[0] !== 'customer.subscription.deleted' ||
      c.status[0] === 'canceled'
  );
}

function subscriptionOf(c: Case): Record<string, unknown> {
  return {
    id: 'sub_matrix',
    object: 'subscription',
    customer: 'cus_matrix',
    status: c.status[0],
    cancel_at_period_end: c.cancel,
    cancel_at: null,
    canceled_at: c.endedAt[1],
    ended_at: c.endedAt[1],
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [
        {
          id: 'si_matrix',
          object: 'subscription_item',
          quantity: 1,
          current_period_start: PERIOD_END_S - 30 * 86_400,
          current_period_end: PERIOD_END_S,
          price: { id: 'price_matrix', lookup_key: c.price[0] },
        },
      ],
    },
    metadata: {},
  };
}

function expected(c: Case): CallbackResult {
  if (c.event[1] === 'ignore') return { kind: 'ignored' };
  const status = c.status[1];
  const ended = status === 'ended';
  return {
    kind: 'membership',
    provider: 'mock',
    customerId: 'cus_matrix',
    subscriptionId: 'sub_matrix',
    offerPriceKey: c.price[1],
    membership: {
      status,
      periodEndMs: ended ? c.endedAt[2] : PERIOD_END_S * 1000,
      endsAtPeriodEnd: !ended && c.cancel,
    },
  };
}

function label(c: Case): string {
  return [
    c.status[0],
    c.cancel ? 'cancel' : 'keep',
    `ended_at=${c.endedAt[0]}`,
    `price=${String(c.price[0])}`,
    c.event[0],
  ].join(' ');
}

describe('mock → membership mapping, every combination', () => {
  test('each case projects as the tables say', async () => {
    let current: Record<string, unknown> = {};
    const billing = new MockMembershipBilling({
      origin: 'http://billing.matrix',
      secretKey: 'sk_test_matrix',
      webhookSecret: WEBHOOK_SECRET,
      offer: CONTRACT_OFFER,
      now: () => NOW_MS,
      fetch: () => Promise.resolve(Response.json(current)),
    });
    let n = 0;
    for (const c of cases()) {
      n += 1;
      current = subscriptionOf(c);
      const rawBody = JSON.stringify({
        id: `evt_${String(n)}`,
        object: 'event',
        type: c.event[0],
        data: { object: current },
      });
      const header = signMockBillingPayload({
        secret: WEBHOOK_SECRET,
        payload: rawBody,
        timestampS: NOW_MS / 1000,
      });
      const result = await billing.readCallback({
        headers: new Headers({ [MOCK_BILLING_SIGNATURE_HEADER]: header }),
        rawBody,
      });
      expect({ case: label(c), result }).toEqual({
        case: label(c),
        result: expected(c),
      });
    }
    // 9 statuses × 2 × 3 × 4 × 7 non-deleted events, plus the canceled rows'
    // deleted event (2 × 3 × 4).
    expect(n).toBe(9 * 2 * 3 * 4 * 7 + 2 * 3 * 4);
  });
});
