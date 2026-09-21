// goal:guest-free-and-paid:9
import { describe, expect, test } from 'bun:test';
import {
  checkoutPlusAtProvider,
  observeMembership,
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  billingTier,
  type MembershipRowView,
  membershipRow,
  membershipRows,
} from '@libs/billing/sim/billing-reads';
import { focusActor, signInWithGoogle, spawnActor } from '@libs/sim-harness';
import { sql } from '@pkgs/sql';
import { openSim } from './support/open-billing-sim';

type OpenSim = Awaited<ReturnType<typeof openSim>>;

/** Sign in, open billing and subscribe — the starting point of every case. */
async function plus(testId: string): Promise<OpenSim> {
  const s = await openSim(testId);
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(openBilling, 'alice');
  await s.apply(subscribeToPlus, 'alice');
  return s;
}

/** Synced rows land a few virtual seconds after the server write. */
async function waitRow(
  s: OpenSim,
  match: (row: MembershipRowView) => boolean
): Promise<MembershipRowView> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await s.advanceTime(10_000);
    const row = await s.read(membershipRow, 'alice');
    if (row !== null && match(row)) return row;
  }
  throw new Error('membership row never matched');
}

async function waitStatus(
  s: OpenSim,
  status: string
): Promise<MembershipRowView> {
  return await waitRow(s, (row) => row.status === status);
}

async function settle(s: OpenSim): Promise<void> {
  await s.advanceTime(6000);
}

describe('billing lifecycle', () => {
  test('the trial becomes active at the period end', async () => {
    await using s = await plus('billing-lifecycle-activate');
    await s.apply(observeMembership, 'alice', 'period_end');
    const row = await waitStatus(s, 'active');
    expect(row.price_key).toBe('subscription_monthly');
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('a renewal moves the period end forward and stays paid', async () => {
    await using s = await plus('billing-lifecycle-renew');
    const first = await waitStatus(s, 'trialing');
    await s.apply(observeMembership, 'alice', 'period_end');
    const second = await waitStatus(s, 'active');
    expect(Date.parse(second.current_period_end ?? '')).toBeGreaterThan(
      Date.parse(first.current_period_end ?? '')
    );
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('a failed payment is delinquent but stays paid inside grace', async () => {
    await using s = await plus('billing-lifecycle-delinquent');
    await s.apply(observeMembership, 'alice', 'payment_failed');
    await waitStatus(s, 'delinquent');
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('a recovered payment is active with a future period end', async () => {
    await using s = await plus('billing-lifecycle-recovered');
    await s.apply(observeMembership, 'alice', 'payment_failed');
    await waitStatus(s, 'delinquent');
    await s.apply(observeMembership, 'alice', 'payment_recovered');
    const row = await waitStatus(s, 'active');
    expect(Date.parse(row.current_period_end ?? '')).toBeGreaterThan(0);
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('cancel_at_period_end keeps it paid, then the period end ends it', async () => {
    await using s = await plus('billing-lifecycle-cancel-at-end');
    await s.apply(observeMembership, 'alice', 'cancel_at_period_end');
    const canceled = await waitRow(s, (row) => row.cancel_at_period_end === 1);
    expect(canceled.status).toBe('trialing');
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('paid');

    await s.apply(observeMembership, 'alice', 'period_end');
    await waitStatus(s, 'ended');
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('resuming before the period end keeps the membership live', async () => {
    await using s = await plus('billing-lifecycle-resume');
    await s.apply(observeMembership, 'alice', 'cancel_at_period_end');
    await waitRow(s, (row) => row.cancel_at_period_end === 1);
    await s.apply(observeMembership, 'alice', 'resume');
    const row = await waitRow(
      s,
      (candidate) => candidate.cancel_at_period_end === 0
    );
    expect(row.status).toBe('trialing');
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('cancel_now ends the membership immediately', async () => {
    await using s = await plus('billing-lifecycle-cancel-now');
    await s.apply(observeMembership, 'alice', 'cancel_now');
    await waitStatus(s, 'ended');
  });

  test('resubscribing after the end starts a new live membership', async () => {
    await using s = await plus('billing-lifecycle-resubscribe');
    await s.apply(observeMembership, 'alice', 'cancel_now');
    await waitStatus(s, 'ended');
    // The billing screen keeps Subscribe hidden while the grace window still
    // grants access, so start the fresh checkout at the provider edge.
    await s.apply(checkoutPlusAtProvider, 'alice');
    await s.advanceTime(10_000);
    const rows = await s.read(membershipRows, 'alice');
    expect(rows).toHaveLength(2);
    const row = rows[1];
    if (row === undefined) throw new Error('expected a fresh membership row');
    expect(row.status).toBe('trialing');
    expect(row.price_key).toBe('subscription_monthly');
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('switching the interval flips the price key and stays paid', async () => {
    await using s = await plus('billing-lifecycle-switch');
    await s.apply(observeMembership, 'alice', 'switch_interval');
    const switched = await waitRow(
      s,
      (candidate) => candidate.price_key === 'subscription_yearly'
    );
    expect(switched.status).toBe('active');
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('an incomplete payment is not paid and an expired one has ended', async () => {
    await using s = await plus('billing-lifecycle-incomplete');
    await s.apply(observeMembership, 'alice', 'payment_incomplete');
    await waitStatus(s, 'incomplete');
    await settle(s);
    expect(await s.read(billingTier, 'alice')).toBe('free');

    await s.apply(observeMembership, 'alice', 'payment_expired');
    await waitStatus(s, 'ended');
  });

  test('a guest actor is a guest and a second signed-in actor stays free', async () => {
    await using s = await plus('billing-lifecycle-actors');
    await s.apply(spawnActor, 'bob');
    await s.apply(focusActor, 'bob');
    await s.apply(openBilling, 'bob');
    expect(await s.read(billingTier, 'bob')).toBe('guest');

    await s.apply(signInWithGoogle, 'bob');
    await s.apply(openBilling, 'bob');
    expect(await s.read(billingTier, 'bob')).toBe('free');
    await settle(s);
    await s.apply(focusActor, 'alice');
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });

  test('the same observe twice leaves one identical row', async () => {
    await using s = await plus('billing-lifecycle-idempotent');
    await s.apply(observeMembership, 'alice', 'payment_failed');
    const first = await waitStatus(s, 'delinquent');
    await s.apply(observeMembership, 'alice', 'payment_failed');
    await settle(s);
    const second = await waitStatus(s, 'delinquent');
    expect(second).toEqual(first);
    const serverRows = await s.read(async (surf) =>
      surf.sim.serverSql.sqlClient.query<{ readonly n: number | string }>(
        sql`
          SELECT COUNT(*) AS n
          FROM billing_subscriptions
          WHERE deleted_at IS NULL`
      )
    );
    expect(Number(serverRows[0]?.n ?? 0)).toBe(1);
  });
});
