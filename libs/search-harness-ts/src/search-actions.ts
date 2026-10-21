import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { peopleSearchShowsAnswer } from '@libs/search-shared-ts/search-result-phase';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { USER_SEARCH_DEBOUNCE_MS } from '@libs/user-search-shared-ts/user-search-types';

const WAIT_MS = 10_000;

type ActorDriver = Awaited<ReturnType<typeof actorUi>>;

/** A painted row, nobody, offline, or sign-in. Not the spinner or list shell. */
async function peopleSearchAnswered(ui: ActorDriver): Promise<boolean> {
  return peopleSearchShowsAnswer({
    loading: await ui.get(Handles.searchLoading).isVisible(),
    empty: await ui.get(Handles.searchEmpty).isVisible(),
    needsConnection: await ui.get(Handles.searchNeedsConnection).isVisible(),
    denied: await ui.get(Handles.searchDenied).isVisible(),
    paintedRow: await ui.get(Handles.searchResultRow).isVisible(),
  });
}

/**
 * Move the clock across one keystroke debounce that the simulation actually
 * ran. A starved advance does not commit the username, so it is tried again.
 */
async function advanceSearchDebounce(s: ProductHarness): Promise<void> {
  let waited = 0;
  while (waited < WAIT_MS) {
    const starvedBefore = s.session.scheduler.starvedAdvances();
    await s.session.advanceTime(USER_SEARCH_DEBOUNCE_MS);
    await s.session.waitForIdle();
    if (s.session.scheduler.starvedAdvances() === starvedBefore) return;
    waited += USER_SEARCH_DEBOUNCE_MS;
  }
  throw new Error(
    `Timed out after ${String(WAIT_MS)}ms waiting for the people-search debounce`
  );
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
    await s.session.waitForIdle();
    // The previous person is still painted until this keystroke's debounce
    // commits. Probing first would accept that person, and the next step's
    // wall-clock wait would never fire the timer.
    await advanceSearchDebounce(s);
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
