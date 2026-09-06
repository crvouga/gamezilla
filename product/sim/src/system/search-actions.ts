import { Handles } from '@libs/test-ids';

import { actorUi, scenarioAction } from './actor-ui';

const WAIT_MS = 10_000;

export const searchUsername = scenarioAction({
  name: 'searchUsername',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabSearch).tap();
    await ui.get(Handles.searchInput).expect.visible({ timeoutMs: WAIT_MS });
    const input = ui.get(Handles.searchInput);
    await input.clear();
    await input.input(username);
    await s.session.waitForIdle();
    // Debounce + HTTP must settle; a stuck Searching… spinner fails here.
    await ui.get(Handles.searchLoading).expect.hidden({ timeoutMs: WAIT_MS });
    await ui.get(Handles.friendAdd(username)).expect.visible({
      timeoutMs: WAIT_MS,
    });
  },
});

export const addFriend = scenarioAction({
  name: 'addFriend',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.friendAdd(username)).tap();
  },
});
