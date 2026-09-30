import {
  actorUi,
  pollUntil,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import { Handles } from '@libs/test-ids';
import { USER_SEARCH_DEBOUNCE_MS } from '@libs/user-search/public/user-search-types';

const WAIT_MS = 10_000;

type ActorDriver = Awaited<ReturnType<typeof actorUi>>;

/** A settled answer: the list, nobody, offline, or sign-in. Not the spinner. */
async function peopleSearchAnswered(ui: ActorDriver): Promise<boolean> {
  if (await ui.get(Handles.searchLoading).isVisible()) return false;
  const markers = [
    Handles.searchEmpty,
    Handles.searchNeedsConnection,
    Handles.searchDenied,
    Handles.searchResults,
  ];
  for (const marker of markers) {
    if (await ui.get(marker).isVisible()) return true;
  }
  return false;
}

export const searchUsername = scenarioAction({
  name: 'searchUsername',
  act: async (s, actorId: string, username: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.tabSearch).tap();
    await ui.get(Handles.searchInput).expect.visible({ timeoutMs: WAIT_MS });
    const input = ui.get(Handles.searchInput);
    // Drop the previous person before the next username is typed, so their
    // row cannot be mistaken for this search's answer.
    await input.clear();
    await s.session.waitForIdle();
    await input.input(username);
    // Idle arms the keystroke timer. The probe does not treat a hidden
    // spinner as done: that is also the state before the timer fires, and
    // stopping there leaves the clock short of the new search.
    await s.session.waitForIdle();
    await pollUntil(
      s,
      async () => ((await peopleSearchAnswered(ui)) ? true : null),
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
