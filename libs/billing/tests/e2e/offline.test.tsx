import { describe, expect, test } from 'bun:test';
import {
  observeMembership,
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  billingTier,
  serverMembershipRow,
} from '@libs/billing/sim/billing-reads';
import {
  accountIdOf,
  caps,
  partition,
  restoreNetwork,
  signInWithGoogle,
} from '@libs/sim-harness';
import { openSim } from './support/open-billing-sim';

describe('billing offline grace', () => {
  test('the synced delinquent row answers paid while partitioned', async () => {
    await using s = await openSim('billing-offline-grace');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(openBilling, 'alice');
    await s.apply(subscribeToPlus, 'alice');
    await s.apply(observeMembership, 'alice', 'payment_failed');
    await s.advanceTime(6000);

    const hostCaps = await s.read(caps);
    if (!hostCaps.includes('partition')) {
      // Live-browser hosts have no network to cut; the local answer is the
      // same read either way.
      let threw = false;
      try {
        await s.apply(partition, 'alice');
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } else {
      await s.apply(partition, 'alice');
      // Local row + local clock answer while the server is unreachable.
      expect(await s.read(billingTier, 'alice')).toBe('paid');
      await s.apply(restoreNetwork);
      await s.advanceTime(6000);
    }

    expect(await s.read(billingTier, 'alice')).toBe('paid');
    const accountId = await s.read(accountIdOf, 'alice');
    if (accountId === null) throw new Error('expected a signed-in account');
    const server = await s.read(serverMembershipRow, accountId);
    expect(server?.status).toBe('delinquent');
  });
});
