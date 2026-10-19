/**
 * A custom game with the keyboard alone and by listening: choosing a bot for
 * a side and starting move from control to control, and what the screen's
 * live status tells a person listening to the app.
 */

import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { actorPage, tabTo } from '@libs/harness/actor-page';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { isHiddenFromAt } from '@pkgs/a11y-shared/visibility';
import { readCustomGameProbe } from './custom-game-probe';
import { waitCustomGameSettled } from './custom-game-ui';

/** `actor` assigns a bot to `side` using the keyboard alone. */
export const assignCustomGameBotWithKeyboard = scenarioAction({
  name: 'assignCustomGameBotWithKeyboard',
  act: async (s, actor: string, side: CustomGameSide) => {
    const probe = await readCustomGameProbe(s, actor);
    if (probe === null) throw new Error(`${actor} sees no custom game`);
    const ui = await actorUi(s, actor);
    await tabTo(s, actor, `custom-game-${side}-choices`);
    await ui.key('enter');
    await s.session.waitForIdle();
    await tabTo(s, actor, `custom-game-${side}-bot`);
    await ui.key('enter');
    await waitCustomGameSettled(s, actor, probe.settled);
  },
});

/** `actor` starts the custom game using the keyboard alone. */
export const startCustomGameWithKeyboard = scenarioAction({
  name: 'startCustomGameWithKeyboard',
  act: async (s, actor: string) => {
    const probe = await readCustomGameProbe(s, actor);
    if (probe === null) throw new Error(`${actor} sees no custom game`);
    await tabTo(s, actor, 'custom-game-start');
    await (await actorUi(s, actor)).key('enter');
    await waitCustomGameSettled(s, actor, probe.settled);
  },
});

/** `actor` listens to the custom game as the app reads it aloud. */
export const listenToCustomGame = scenarioAction({
  name: 'listenToCustomGame',
  act: async (s, actor: string) => {
    await actorPage(s, actor);
  },
});

/** What the live status says to a person listening, and any ACT failures. */
export async function readCustomGameHeard(s: ProductHarness, actor: string) {
  const page = await actorPage(s, actor);
  const status = page.querySelector('[data-testid="custom-game-status"]');
  if (
    status === null ||
    isHiddenFromAt(status) ||
    status.getAttribute('role') !== 'status' ||
    status.getAttribute('aria-live') !== 'polite'
  )
    throw new Error('the custom game status is not announced');
  return {
    description: status.textContent ?? '',
    problems: auditTree(page).map(formatFailure),
  };
}
