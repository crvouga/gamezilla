// goal:social:5
import { describe, expect, test } from 'bun:test';

import {
  acceptFriendRequest,
  addFriend,
  openFriendsList,
} from '@libs/friends/sim/friends-actions';
import {
  friendRequestCardVisible,
  friendRowVisible,
} from '@libs/friends/sim/friends-ui-reads';
import { searchUsername } from '@libs/search/sim/search-actions';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { openSim } from './support/open-friends-sim';

describe('friends request → accept', () => {
  test('alice sends a request; bob accepts from his inbox; both see each other', async () => {
    await using s = await openSim('accept');
    for (const actor of ['alice', 'bob']) {
      await s.apply(signInWithGoogle, actor);
      await s.apply(returnToTabs, actor);
    }
    await s.apply(searchUsername, 'alice', bobUsername);
    await s.apply(addFriend, 'alice', bobUsername);
    await s.until((surf) =>
      friendRequestCardVisible(surf, 'bob', aliceUsername)
    );
    await s.apply(acceptFriendRequest, 'bob', aliceUsername);

    await s.apply(openFriendsList, 'bob');
    await s.until((surf) => friendRowVisible(surf, 'bob', aliceUsername));
    await s.apply(returnToTabs, 'bob');
    await s.apply(openFriendsList, 'alice');
    await s.until((surf) => friendRowVisible(surf, 'alice', bobUsername), {
      maxMs: 15_000,
    });
    expect(await s.read(friendRowVisible, 'alice', bobUsername)).toBe(true);
  });
});
