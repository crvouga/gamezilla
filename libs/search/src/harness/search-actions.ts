import {
  actorUi,
  pollUntil,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import { Handles } from '@libs/test-ids';

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
    // Debounce + sync query must settle; a stuck Searching… spinner fails here.
    await ui.get(Handles.searchLoading).expect.hidden({ timeoutMs: WAIT_MS });
  },
});

/**
 * Search for `text` again and again until search settles on nobody — what a
 * person does while a change (a block, a rename) reaches them. Fails after
 * `maxMs`.
 */
export const searchUntilNobody = scenarioAction({
  name: 'searchUntilNobody',
  act: async (s, actorId: string, text: string, maxMs: number) => {
    const ui = await actorUi(s, actorId);
    await pollUntil(
      s,
      async () => {
        await Promise.resolve(searchUsername.act(s, actorId, text));
        return (await ui.get(Handles.searchEmpty).isVisible()) ? true : null;
      },
      { maxMs, description: `search for ${text} shows nobody` }
    );
  },
});

export const SEARCH_HARNESS_ACTIONS = [searchUsername, searchUntilNobody];
