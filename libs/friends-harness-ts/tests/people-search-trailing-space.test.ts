import { expect, test } from 'bun:test';
import { prepareNamedFriend } from '@libs/friends-harness-ts/setup-friend-request';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { searchUsername } from '@libs/search-harness-ts/search-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { USER_SEARCH_DEBOUNCE_MS } from '@libs/user-search-shared-ts/user-search-types';
import { openHarness } from './open-friends-harness';

/** What a phone's keyboard does after it completes a word: a space. */
const typeSpaceAfterName = scenarioAction({
  name: 'peopleSearchTrailingSpace.typeSpace',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.searchInput).input(' ');
    await s.session.waitForIdle();
    // Past the debounce, and long enough for an answer if one were coming.
    for (let step = 0; step < 6; step += 1) {
      await s.session.advanceTime(USER_SEARCH_DEBOUNCE_MS);
      await s.session.waitForIdle();
    }
  },
});

const searchScreen = scenarioAction({
  name: 'peopleSearchTrailingSpace.read',
  report: false,
  act: async (s, actorId: string, into: Record<string, boolean>) => {
    const ui = await actorUi(s, actorId);
    into['searching'] = await ui.get(Handles.searchLoading).isVisible();
    into['found'] = await ui.get(Handles.searchResultRow).isVisible();
  },
});

// regression: people-search-trailing-space-searches-forever
test('a space typed after the name leaves the person found, not searched for again', async () => {
  await using s = await openHarness('people-search-trailing-space');
  await prepareNamedFriend(s, 'alice');
  await prepareNamedFriend(s, 'bob');
  await s.apply(searchUsername, 'alice', 'bob');

  await s.apply(typeSpaceAfterName, 'alice');

  const screen: Record<string, boolean> = {};
  await s.apply(searchScreen, 'alice', screen);
  expect(screen).toEqual({ searching: false, found: true });
});
