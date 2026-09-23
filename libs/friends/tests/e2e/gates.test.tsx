// goal:social:1
/**
 * Friends are for people with an account. A guest who reaches for them is
 * asked to sign in, right there; a signed-in person with no friends yet is
 * pointed at people search.
 */
import { describe, expect, test } from 'bun:test';

import { openFriendsList } from '@libs/friends/sim/friends-actions';
import {
  handleVisible,
  readFriendsCount,
} from '@libs/friends/sim/friends-ui-reads';
import { tapFriendPill } from '@libs/friends/sim/person-actions';
import { searchUsername } from '@libs/search/sim/search-actions';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-friends-sim';

const action = (handle: string): string => `${handle}-action`;

describe('friends gates', () => {
  test('a guest is asked to sign in, on search and on the friends list', async () => {
    await using s = await openSim('gates-guest');
    await s.apply(searchUsername, 'alice', 'bob');
    expect(await s.read(handleVisible, 'alice', Handles.searchDenied)).toBe(
      true
    );
    await s.apply(tapFriendPill, 'alice', action(Handles.searchDenied));
    expect(await s.read(handleVisible, 'alice', Handles.authMethodGoogle)).toBe(
      true
    );
  });

  test('a guest’s friends row asks them to sign in', async () => {
    await using s = await openSim('gates-guest-list');
    expect(await s.read(readFriendsCount, 'alice')).toBe('0');
    await s.apply(openFriendsList, 'alice');
    await s.until((surf) =>
      handleVisible(surf, 'alice', Handles.authMethodGoogle)
    );
  });

  test('no friends yet: the list says so and Find friends opens search', async () => {
    await using s = await openSim('gates-empty-list');
    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(openFriendsList, 'alice');
    await s.until((surf) => handleVisible(surf, 'alice', Handles.friendsEmpty));
    await s.apply(tapFriendPill, 'alice', action(Handles.friendsEmpty));
    expect(await s.read(handleVisible, 'alice', Handles.searchInput)).toBe(
      true
    );
  });
});
