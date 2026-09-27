/**
 * A provider event delivered twice changes nothing: after a failed payment,
 * redelivering the provider's last event leaves the member's membership
 * exactly as it was, on the server and on their device, with one membership
 * on the server. The lifecycle walk (`lifecycle-walk.test.tsx`) explores
 * redelivery from random states; this pins the delinquent case literally.
 */
import { describe, expect, test } from 'bun:test';
import {
  observeMembership,
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  membershipRow,
  serverMembershipCount,
  serverMembershipRow,
} from '@libs/billing/sim/billing-reads';
import { accountIdOf, signInWithGoogle } from '@libs/sim-harness';
import { openSim } from './support/open-billing-sim';

const ALICE = 'alice';
const WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;
/** Long enough for a redelivered event to have reached the device. */
const SETTLE_MS = 6_000;

describe('a redelivered provider event', () => {
  test('leaves a delinquent membership exactly as it was', async () => {
    await using s = await openSim('billing-redelivered-event');
    await s.apply(signInWithGoogle, ALICE);
    await s.apply(openBilling, ALICE);
    await s.apply(subscribeToPlus, ALICE);
    await s.apply(observeMembership, ALICE, 'payment_failed');
    const before = await s.until((sim) => membershipRow(sim, ALICE), {
      ...WAIT,
      pred: (row) => row?.status === 'delinquent',
    });
    const accountId = await s.read(accountIdOf, ALICE);
    if (accountId === null) throw new Error('alice is not signed in');
    const serverBefore = await s.read(serverMembershipRow, accountId);
    expect(serverBefore).toEqual(before);

    await s.apply(observeMembership, ALICE, 'redeliver_last_event');
    await s.advanceTime(SETTLE_MS);

    expect(await s.read(membershipRow, ALICE)).toEqual(before);
    expect(await s.read(serverMembershipRow, accountId)).toEqual(before);
    expect(await s.read(serverMembershipCount)).toBe(1);
  }, 120_000);
});
