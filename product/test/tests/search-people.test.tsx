/**
 * People search must settle: Typing a username must not leave the UI on an
 * eternal "Searching…" spinner (debounce + POST /friends/search).
 */

import { describe, test } from 'bun:test';

import { aliceUsername, bobUsername } from '../src/fixtures/fixtures';
import { openSim } from '../src/setup/open-sim';
import { returnToTabs, searchUsername, signInWithDev } from '../src/sim';

describe('people search', () => {
  test('search settles and finds bob by username', async () => {
    await using sim = await openSim('search-people');
    await sim.apply(signInWithDev, 'alice');
    await sim.apply(returnToTabs, 'alice');
    await sim.apply(signInWithDev, 'bob');
    await sim.apply(returnToTabs, 'bob');
    // searchUsername asserts Handles.searchLoading goes hidden, then friendAdd.
    await sim.apply(searchUsername, 'alice', bobUsername);
    await sim.apply(searchUsername, 'bob', aliceUsername);
  });
});
