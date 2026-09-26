/**
 * Friends' (and spaces') monkey: a seeded random walk over the platform's
 * steps and friends' own (look someone up and add them, answer the inbox,
 * open the list) plus spaces' (host, step out, end, members), starting from
 * two signed-in people, with every standing property checked after each step.
 */

import { describe, test } from 'bun:test';
import { FRIENDS_WALK_ACTIONS } from '@libs/friends/sim/friends-walk';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { runMonkey } from '@libs/sim-harness/open-sim/monkey';
import { SPACES_WALK_ACTIONS } from '@libs/spaces/sim/space-walk';
import { openSim } from './support/open-friends-sim';

describe('friends monkey', () => {
  test('a random walk through friends and spaces holds every standing property', async () => {
    await using s = await openSim('monkey');
    for (const actor of ['alice', 'bob']) {
      await s.apply(signInWithGoogle, actor);
      await s.apply(returnToTabs, actor);
    }
    await runMonkey(s, {
      walks: [...FRIENDS_WALK_ACTIONS, ...SPACES_WALK_ACTIONS],
    });
  }, 300_000);
});
