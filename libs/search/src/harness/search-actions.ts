import {
  actorUi,
  pollUntil,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import { Handles } from '@libs/test-ids';
import { USER_SEARCH_DEBOUNCE_MS } from '@libs/user-search/public/user-search-types';

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
    // Idle flushes the effect that arms the keystroke timer. That timer is
    // still in the future, so advance it before waiting on the spinner.
    await s.session.waitForIdle();
    await s.session.advanceTime(USER_SEARCH_DEBOUNCE_MS);
    await s.session.waitForIdle();
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
