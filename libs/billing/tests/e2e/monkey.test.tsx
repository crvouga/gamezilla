/**
 * Billing's monkey: a seeded random walk over the platform's steps and
 * billing's own (open the plans screen, subscribe through the provider's
 * checkout), starting from a signed-in person, with every standing property
 * checked after each step.
 */

import { describe, test } from 'bun:test';
import { BILLING_WALK_ACTIONS } from '@libs/billing/sim/billing-walk';
import { signInWithGoogle } from '@libs/sim-harness';
import { runMonkey } from '@libs/sim-harness/open-sim/monkey';
import { openSim } from './support/open-billing-sim';

describe('billing monkey', () => {
  test('a random walk through billing holds every standing property', async () => {
    await using s = await openSim('monkey');
    await s.apply(signInWithGoogle, 'alice');
    await runMonkey(s, { walks: BILLING_WALK_ACTIONS });
  }, 300_000);
});
