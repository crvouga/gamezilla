/**
 * People search must settle: Typing a username must not leave the UI on an
 * eternal "Searching…" spinner (debounce + searchProfiles sync query).
 *
 * Lives with friends, not search: the `searchProfiles` sync query and the
 * `friends_blocks` filter people search reads are friends', and search cannot
 * compose friends (friends depends on search).
 */

import { describe, expect, test } from 'bun:test';
import { searchUsername } from '@libs/search/sim/search-actions';
import { searchResultVisible } from '@libs/search/sim/search-ui-reads';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import {
  aliceUsername,
  bobUsername,
} from '@libs/sim-harness/open-sim/fixtures';
import { openSim } from './support/open-friends-sim';

describe('people search', () => {
  test('search settles and finds bob by username', async () => {
    await using sim = await openSim('search-people');
    await sim.apply(signInWithGoogle, 'alice');
    await sim.apply(returnToTabs, 'alice');
    await sim.apply(signInWithGoogle, 'bob');
    await sim.apply(returnToTabs, 'bob');
    // searchUsername asserts Handles.searchLoading goes hidden; then the found
    // person's row (search's own, whatever fills its slot) must show.
    await sim.apply(searchUsername, 'alice', bobUsername);
    expect(await sim.read(searchResultVisible, 'alice', bobUsername)).toBe(
      true
    );
    await sim.apply(searchUsername, 'bob', aliceUsername);
    expect(await sim.read(searchResultVisible, 'bob', aliceUsername)).toBe(
      true
    );
  });
});
