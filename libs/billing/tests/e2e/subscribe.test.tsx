// goal:guest-free-and-paid:7
import { describe, expect, test } from 'bun:test';
import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  billingTier,
  membershipRow,
  serverMembershipRow,
} from '@libs/billing/sim/billing-reads';
import { accountIdOf, signInWithGoogle } from '@libs/sim-harness';
import { openSim } from './support/open-billing-sim';

describe('billing subscribe', () => {
  test('sign in → subscribe → paid tier with a trialing monthly row', async () => {
    await using s = await openSim('billing-subscribe-monthly');

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(openBilling, 'alice');
    expect(await s.read(billingTier, 'alice')).toBe('free');

    await s.apply(subscribeToPlus, 'alice');
    expect(await s.read(billingTier, 'alice')).toBe('paid');

    const row = await s.read(membershipRow, 'alice');
    expect(row?.status).toBe('trialing');
    expect(row?.price_key).toBe('subscription_monthly');
    expect(Date.parse(row?.current_period_end ?? '')).toBeGreaterThan(
      Date.parse('2020-01-01T00:00:00.000Z')
    );

    const accountId = await s.read(accountIdOf, 'alice');
    if (accountId === null) throw new Error('expected a signed-in account');
    const server = await s.read(serverMembershipRow, accountId);
    expect(server?.status).toBe(row?.status);
    expect(server?.price_key).toBe(row?.price_key);
  });
});
