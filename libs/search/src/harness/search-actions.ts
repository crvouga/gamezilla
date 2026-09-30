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
    // Idle flushes the effect that arms the keystroke timer. Polling then
    // advances that timer until Searching leaves. One advance is not enough
    // when focus has already moved virtual time, or the timer is armed late:
    // the spinner would stay hidden on the previous person and the clock
    // would never reach the new search.
    await s.session.waitForIdle();
    await pollUntil(
      s,
      async () =>
        (await ui.get(Handles.searchLoading).isVisible()) ? null : true,
      {
        maxMs: WAIT_MS,
        stepMs: USER_SEARCH_DEBOUNCE_MS,
        description: `search for ${username} settles`,
      }
    );
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
