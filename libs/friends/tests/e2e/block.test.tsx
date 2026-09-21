import { describe, expect, test } from 'bun:test';

import {
  blockFriend,
  openFriendsList,
  unblockFriend,
} from '@libs/friends/sim/friends-actions';
import {
  addFriendOffered,
  friendRowVisible,
} from '@libs/friends/sim/friends-ui-reads';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { searchUsername } from '@libs/search/sim/search-actions';
import { searchResultVisible } from '@libs/search/sim/search-ui-reads';
import { returnToTabs } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { openSim } from './support/open-friends-sim';

describe('friends → block / unblock', () => {
  test('blocking ends the friendship for both; unblocking lets them start over', async () => {
    await using s = await openSim('block-unblock');
    await setupFriendsPair(s);

    await s.apply(blockFriend, 'alice', bobUsername);
    await s.apply(returnToTabs, 'alice');
    await s.apply(openFriendsList, 'alice');
    expect(await s.read(friendRowVisible, 'alice', bobUsername)).toBe(false);
    await s.apply(openFriendsList, 'bob');
    await s.until((surf) => friendRowVisible(surf, 'bob', aliceUsername), {
      pred: (visible) => !visible,
      maxMs: 15_000,
    });

    // A blocked person cannot find the blocker, so cannot ask again.
    await s.apply(returnToTabs, 'bob');
    await s.apply(searchUsername, 'bob', aliceUsername);
    expect(await s.read(searchResultVisible, 'bob', aliceUsername)).toBe(false);

    // The blocker can still find them — that row is where Unblock lives.
    await s.apply(returnToTabs, 'alice');
    await s.apply(unblockFriend, 'alice', bobUsername);
    expect(await s.read(addFriendOffered, 'alice', bobUsername)).toBe(true);
  });
});
