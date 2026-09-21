/**
 * Profile's (and auth's) monkey: a seeded random walk over the platform's
 * steps — spawn, sign in, partition, restore, navigate — and renaming, with
 * every standing property checked after each step.
 */

import { describe, test } from 'bun:test';
import { PROFILE_WALK_ACTIONS } from '@libs/profile/sim/profile-walk';
import { runMonkey } from '@libs/sim-harness/open-sim/monkey';
import { openSim } from './support/open-profile-sim';

describe('profile monkey', () => {
  test('a random walk through profile and sign-in holds every standing property', async () => {
    await using s = await openSim('monkey');
    await runMonkey(s, { walks: PROFILE_WALK_ACTIONS });
  }, 300_000);
});
