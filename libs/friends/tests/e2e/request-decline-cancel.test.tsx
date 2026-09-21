// goal:social:5
import { describe, expect, test } from 'bun:test';

import {
  addFriend,
  cancelFriendRequest,
  declineFriendRequest,
  openFriendsList,
} from '@libs/friends/sim/friends-actions';
import {
  addFriendOffered,
  friendRequestCardVisible,
  friendRowVisible,
} from '@libs/friends/sim/friends-ui-reads';
import { searchUsername } from '@libs/search/sim/search-actions';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import type { OpenSim } from '@libs/sim-harness/open-sim/open-sim';
import { openSim } from './support/open-friends-sim';

async function signInBoth(s: OpenSim): Promise<void> {
  for (const actor of ['alice', 'bob']) {
    await s.apply(signInWithGoogle, actor);
    await s.apply(returnToTabs, actor);
  }
}

describe('friends request → decline / cancel', () => {
  test('bob declines: neither is a friend, and alice may ask again', async () => {
    await using s = await openSim('decline');
    await signInBoth(s);
    await s.apply(searchUsername, 'alice', bobUsername);
    await s.apply(addFriend, 'alice', bobUsername);
    await s.until((surf) =>
      friendRequestCardVisible(surf, 'bob', aliceUsername)
    );

    await s.apply(declineFriendRequest, 'bob', aliceUsername);
    expect(await s.read(friendRequestCardVisible, 'bob', aliceUsername)).toBe(
      false
    );
    await s.apply(openFriendsList, 'bob');
    expect(await s.read(friendRowVisible, 'bob', aliceUsername)).toBe(false);

    // The request is gone on alice's side too: search offers Add again.
    await s.until(
      async (surf) => {
        await Promise.resolve(searchUsername.act(surf, 'alice', bobUsername));
        return addFriendOffered(surf, 'alice', bobUsername);
      },
      { maxMs: 15_000 }
    );
    await s.apply(openFriendsList, 'alice');
    expect(await s.read(friendRowVisible, 'alice', bobUsername)).toBe(false);
  });

  test('alice cancels: the request leaves bob’s inbox', async () => {
    await using s = await openSim('cancel');
    await signInBoth(s);
    await s.apply(searchUsername, 'alice', bobUsername);
    await s.apply(addFriend, 'alice', bobUsername);
    await s.until((surf) =>
      friendRequestCardVisible(surf, 'bob', aliceUsername)
    );

    await s.apply(cancelFriendRequest, 'alice', bobUsername);
    expect(await s.read(addFriendOffered, 'alice', bobUsername)).toBe(true);
    await s.until(
      (surf) => friendRequestCardVisible(surf, 'bob', aliceUsername),
      { pred: (visible) => !visible, maxMs: 15_000 }
    );
  });
});
