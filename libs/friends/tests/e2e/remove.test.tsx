// goal:social:5
import { describe, expect, test } from 'bun:test';

import {
  openFriendsList,
  removeFriend,
} from '@libs/friends/sim/friends-actions';
import { friendRowVisible } from '@libs/friends/sim/friends-ui-reads';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { returnToTabs } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { openSim } from './support/open-friends-sim';

describe('friends → remove', () => {
  test('alice removes bob: the friendship is gone for both', async () => {
    await using s = await openSim('remove');
    await setupFriendsPair(s);

    await s.apply(removeFriend, 'alice', bobUsername);
    await s.apply(returnToTabs, 'alice');
    await s.apply(openFriendsList, 'alice');
    expect(await s.read(friendRowVisible, 'alice', bobUsername)).toBe(false);

    // Bob's list follows live — no reload, no action of his.
    await s.apply(openFriendsList, 'bob');
    await s.until((surf) => friendRowVisible(surf, 'bob', aliceUsername), {
      pred: (visible) => !visible,
      maxMs: 15_000,
    });
  });
});
