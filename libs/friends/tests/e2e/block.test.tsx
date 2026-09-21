import { describe, expect, test } from 'bun:test';

import {
  blockFriend,
  openFriendsList,
  unblockFriend,
} from '@libs/friends/sim/friends-actions';
import {
  addFriendOffered,
  friendRequestCardVisible,
  friendRowVisible,
  handleVisible,
} from '@libs/friends/sim/friends-ui-reads';
import {
  blockPerson,
  openPersonFromSearch,
  tapFriendPill,
  viewProfileFromRequest,
} from '@libs/friends/sim/person-actions';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { searchUsername } from '@libs/search/sim/search-actions';
import { searchResultVisible } from '@libs/search/sim/search-ui-reads';
import { focusActor, returnToTabs } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-friends-sim';
import { signInPair } from './support/sign-in-pair';

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

  test('a stranger who asks can be blocked from their profile: the request goes, and so do they', async () => {
    await using s = await openSim('block-stranger');
    await signInPair(s);
    await s.apply(openPersonFromSearch, 'bob', aliceUsername);
    await s.apply(tapFriendPill, 'bob', Handles.friendAdd(aliceUsername));
    await s.until((surf) =>
      friendRequestCardVisible(surf, 'alice', bobUsername)
    );

    // Not a friend, but blockable: the request is how alice met him.
    await s.apply(viewProfileFromRequest, 'alice', bobUsername);
    await s.apply(blockPerson, 'alice', bobUsername);
    await s.until(
      (surf) => friendRequestCardVisible(surf, 'alice', bobUsername),
      { pred: (visible) => !visible }
    );

    // Bob's side: his request is withdrawn and alice is nowhere to be found.
    await s.apply(focusActor, 'bob');
    await s.until((surf) =>
      handleVisible(surf, 'bob', Handles.friendAdd(aliceUsername))
    );
    await s.apply(returnToTabs, 'bob');
    await s.until(
      async (surf) => {
        await Promise.resolve(searchUsername.act(surf, 'bob', aliceUsername));
        return handleVisible(surf, 'bob', Handles.searchEmpty);
      },
      { maxMs: 15_000 }
    );

    // Alice (back on her inbox) still finds him — his row is where Unblock lives.
    await s.apply(searchUsername, 'alice', bobUsername);
    expect(
      await s.read(handleVisible, 'alice', Handles.friendUnblock(bobUsername))
    ).toBe(true);
  });
});
