/**
 * Every Stripe subscription the adapter can be handed, projected through the
 * real SDK: status × cancel flag × `ended_at` × price × customer shape ×
 * where this API version puts the period end × event type. The expected
 * `CallbackResult` of each comes from the tables below.
 */
import { describe, expect, test } from 'bun:test';
import type { CallbackResult, MembershipStatus } from '@pkgs/billing-shared/membership';
import { CONTRACT_OFFER } from '@pkgs/billing-shared/contract-fixtures';
import { createStripeMembershipBilling } from '@pkgs/billing-stripe-server/stripe-membership';
import Stripe from 'stripe';

const NOW_MS = 1_800_000_000_000;
const PERIOD_END_S = NOW_MS / 1000 + 7 * 86_400;
const ENDED_EARLY_S = NOW_MS / 1000 - 86_400;
const WEBHOOK_SECRET = 'whsec_matrix';

/** Stripe's statuses (plus one it may add tomorrow) → ours. */
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

/** `ended_at` → the access end an *ended* membership reports. */
const ENDED_AT: ReadonlyArray<readonly [string, number | null, number]> = [
  ['none', null, PERIOD_END_S * 1000],
  ['before the period end', ENDED_EARLY_S, ENDED_EARLY_S * 1000],
  ['at the period end', PERIOD_END_S, PERIOD_END_S * 1000],
];

/** The first item's lookup key → our offer key. */
const PRICES: ReadonlyArray<readonly [string | null, string | null]> = [
  ['subscription_monthly', 'subscription_monthly'],
  ['subscription_yearly', 'subscription_yearly'],
  ['legacy_price', null],
  [null, null],
];

/** Event type → projected, and whether it forces `ended`. */
const EVENTS: ReadonlyArray<
  readonly [string, 'project' | 'project_ended' | 'ignore']
> = [
  ['customer.subscription.created', 'project'],
  ['customer.subscription.updated', 'project'],
  ['customer.subscription.paused', 'project'],
  ['customer.subscription.resumed', 'project'],
  ['customer.subscription.deleted', 'project_ended'],
  ['customer.subscription.trial_will_end', 'ignore'],
  ['invoice.payment_failed', 'ignore'],
  ['checkout.session.completed', 'ignore'],
];

type Case = {
  readonly status: (typeof STATUS)[number];
  readonly cancel: boolean;
  readonly endedAt: (typeof ENDED_AT)[number];
  readonly price: (typeof PRICES)[number];
  readonly expandedCustomer: boolean;
  readonly periodOnItem: boolean;
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
  rows = times(rows, 'expandedCustomer', [false, true]);
  rows = times(rows, 'periodOnItem', [false, true]);
  return times(rows, 'event', EVENTS) as unknown as readonly Case[];
}

function subscriptionOf(c: Case): Record<string, unknown> {
  return {
    id: 'sub_matrix',
    object: 'subscription',
    customer: c.expandedCustomer
      ? { id: 'cus_matrix', object: 'customer' }
      : 'cus_matrix',
    status: c.status[0],
    cancel_at_period_end: c.cancel,
    ended_at: c.endedAt[1],
    ...(c.periodOnItem ? {} : { current_period_end: PERIOD_END_S }),
    items: {
      object: 'list',
      data: [
        {
          id: 'si_matrix',
          ...(c.periodOnItem ? { current_period_end: PERIOD_END_S } : {}),
          price: { id: 'price_matrix', lookup_key: c.price[0] },
        },
      ],
    },
  };
}

function expected(c: Case): CallbackResult {
  if (c.event[1] === 'ignore') return { kind: 'ignored' };
  const status = c.event[1] === 'project_ended' ? 'ended' : c.status[1];
  const ended = status === 'ended';
  return {
    kind: 'membership',
    provider: 'stripe',
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
    c.expandedCustomer ? 'expanded' : 'id',
    c.periodOnItem ? 'item-period' : 'top-period',
    c.event[0],
  ].join(' ');
}

function openBilling(): {
  readonly billing: ReturnType<typeof createStripeMembershipBilling>;
  serve(subscription: Record<string, unknown>): void;
} {
  let current: Record<string, unknown> = {};
  const billing = createStripeMembershipBilling({
    secretKey: 'sk_test_matrix',
    webhookSecret: WEBHOOK_SECRET,
    offer: CONTRACT_OFFER,
    now: () => NOW_MS,
    transport: {
      origin: 'http://stripe.matrix:12111',
      fetch: () => Promise.resolve(Response.json(current)),
    },
  });
  return {
    billing,
    serve: (subscription) => {
      current = subscription;
    },
  };
}

async function projectCase(
  rig: ReturnType<typeof openBilling>,
  c: Case,
  n: number
): Promise<CallbackResult> {
  const subscription = subscriptionOf(c);
  rig.serve(subscription);
  const rawBody = JSON.stringify({
    id: `evt_${String(n)}`,
    object: 'event',
    type: c.event[0],
    data: { object: subscription },
  });
  const header = await Stripe.webhooks.generateTestHeaderStringAsync({
    payload: rawBody,
    secret: WEBHOOK_SECRET,
    timestamp: NOW_MS / 1000,
  });
  return await rig.billing.readCallback({
    headers: new Headers({ 'stripe-signature': header }),
    rawBody,
  });
}

describe('Stripe → membership mapping, every combination', () => {
  const all = cases();

  test('the matrix covers the full cartesian product', () => {
    expect(all.length).toBe(
      STATUS.length *
        2 *
        ENDED_AT.length *
        PRICES.length *
        2 *
        2 *
        EVENTS.length
    );
  });

  // One test per Stripe status × event keeps each well inside the per-test
  // timeout even when the whole gate saturates the CPU (a per-status slice
  // of 768 signed webhooks did not).
  for (const status of STATUS) {
    for (const event of EVENTS) {
      test(`${status[0]} × ${event[0]}: each case projects as the tables say`, async () => {
        const rig = openBilling();
        let n = 0;
        for (const c of all.filter(
          (candidate) =>
            candidate.status === status && candidate.event === event
        )) {
          n += 1;
          const result = await projectCase(rig, c, n);
          expect({ case: label(c), result }).toEqual({
            case: label(c),
            result: expected(c),
          });
        }
        expect(n).toBeGreaterThan(0);
      });
    }
  }
});
