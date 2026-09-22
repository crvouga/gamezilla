// goal:social:3
/**
 * A profile is what other people see of you: rename yourself and your
 * friends' lists show the new name, and search finds you by it — not by the
 * name you gave up.
 */
import { describe, expect, test } from 'bun:test';

import { openFriendsList } from '@libs/friends/sim/friends-actions';
import {
  friendRowVisible,
  handleVisible,
} from '@libs/friends/sim/friends-ui-reads';
import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import {
  openProfileEdit,
  setUsername,
} from '@libs/profile/sim/profile-actions';
import { searchUsername } from '@libs/search/sim/search-actions';
import { searchResultVisible } from '@libs/search/sim/search-ui-reads';
import { focusActor, returnToTabs } from '@libs/sim-harness';
import { bobUsername } from '@libs/sim-harness/open-sim/fixtures';
import { Handles } from '@libs/test-ids';
import { openSim } from './support/open-friends-sim';

const NEW_NAME = 'robert_1';

describe('profile changes reach other people', () => {
  test('bob renames: alice’s friends list and search follow', async () => {
    await using s = await openSim('profile-changes-rename');
    await setupFriendsPair(s);

    await s.apply(openFriendsList, 'alice');
    await s.until((surf) => friendRowVisible(surf, 'alice', bobUsername));

    await s.apply(openProfileEdit, 'bob');
    await s.apply(setUsername, 'bob', NEW_NAME);

    // Alice's list follows live, without her doing anything.
    await s.apply(focusActor, 'alice');
    await s.until((surf) => friendRowVisible(surf, 'alice', NEW_NAME), {
      maxMs: 15_000,
    });
    expect(await s.read(friendRowVisible, 'alice', bobUsername)).toBe(false);

    await s.apply(returnToTabs, 'alice');
    await s.apply(searchUsername, 'alice', NEW_NAME);
    expect(await s.read(searchResultVisible, 'alice', NEW_NAME)).toBe(true);
    await s.apply(searchUsername, 'alice', bobUsername);
    expect(await s.read(handleVisible, 'alice', Handles.searchEmpty)).toBe(
      true
    );
  });
});
