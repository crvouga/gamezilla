// goal:guest-free-and-paid:8
import { describe, expect, test } from 'bun:test';
import {
  billingTier,
  cancelPlus,
  type MembershipRowView,
  membershipRow,
  openBilling,
  resumePlus,
  signInWithGoogle,
  subscribeToPlus,
  switchPlusInterval,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

type OpenSim = Awaited<ReturnType<typeof openSim>>;

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

describe('billing portal', () => {
  test('cancel, resume and switch interval through the mock portal', async () => {
    await using s = await openSim('billing-portal-controls');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(openBilling, 'alice');
    await s.apply(subscribeToPlus, 'alice');

    await s.apply(cancelPlus, 'alice');
    let row = await waitRow(
      s,
      (candidate) => candidate.cancel_at_period_end === 1
    );
    expect(row.status).toBe('trialing');
    expect(await s.read(billingTier, 'alice')).toBe('paid');

    await s.apply(resumePlus, 'alice');
    row = await waitRow(s, (candidate) => candidate.cancel_at_period_end === 0);
    expect(row.status).toBe('trialing');

    await s.apply(switchPlusInterval, 'alice', 'subscription_yearly');
    row = await waitRow(
      s,
      (candidate) => candidate.price_key === 'subscription_yearly'
    );
    expect(row.status).toBe('active');
    expect(await s.read(billingTier, 'alice')).toBe('paid');
  });
});
