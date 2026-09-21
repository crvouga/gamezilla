import { describe, expect, test } from 'bun:test';

import { openFriendsList } from '@libs/friends/sim/friends-actions';
import { friendRowVisible } from '@libs/friends/sim/friends-ui-reads';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { bobUsername } from '@libs/sim-harness/open-sim/fixtures';
import { openSim } from './support/open-friends-sim';

describe('friends lifecycle → remove', () => {
  test('friend relationship is visible before removal flow', async () => {
    await using sim = await openSim('friends-remove');
    await setupFriendsPair(sim);
    await sim.apply(openFriendsList, 'alice');
    await sim.until((surf) => friendRowVisible(surf, 'alice', bobUsername));
    expect(await sim.read(friendRowVisible, 'alice', bobUsername)).toBe(true);
  });
});
