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
  handleText,
} from '@libs/friends/sim/friends-ui-reads';
import { tapFriendPill } from '@libs/friends/sim/person-actions';
import { searchUsername } from '@libs/search/sim/search-actions';
import { returnToTabs } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-friends-sim';
import { signInPair } from './support/sign-in-pair';

describe('friends request → decline / cancel', () => {
  test('bob declines: neither is a friend, and asking again at once is refused with a reason', async () => {
    await using s = await openSim('decline');
    await signInPair(s);
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

    // Asking again straight away is refused, and the pill says why.
    await s.apply(returnToTabs, 'alice');
    await s.apply(searchUsername, 'alice', bobUsername);
    await s.apply(tapFriendPill, 'alice', Handles.friendAdd(bobUsername));
    expect(
      await s.read(handleText, 'alice', Handles.friendAdd(bobUsername))
    ).toBe('Try again later');
    expect(await s.read(friendRequestCardVisible, 'bob', aliceUsername)).toBe(
      false
    );
  });

  test('alice cancels: the request leaves bob’s inbox', async () => {
    await using s = await openSim('cancel');
    await signInPair(s);
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
