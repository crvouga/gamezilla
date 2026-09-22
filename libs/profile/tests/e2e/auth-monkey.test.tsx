/**
 * Auth's monkey: a seeded random walk over the platform's steps (spawn,
 * partition, restore, navigate, sign in with Google) plus auth's own —
 * signing in and out with either provider and address choice, connecting and
 * removing sign-in methods, signing out of every device — with every standing
 * property checked after each step, and every sign-in-method change required
 * to converge on the device.
 */

import { describe, test } from 'bun:test';
import { AUTH_WALK_ACTIONS } from '@libs/sim-harness';
import { runMonkey } from '@libs/sim-harness/open-sim/monkey';

import { openSim } from './support/open-profile-sim';

describe('auth monkey', () => {
  for (const seed of [1, 2, 3]) {
    test(`seed ${String(seed)}: a random walk through sign-in methods holds every property`, async () => {
      await using s = await openSim(`auth-monkey-${String(seed)}`, { seed });
      await runMonkey(s, { walks: AUTH_WALK_ACTIONS, steps: 30 });
    }, 300_000);
  }
});
