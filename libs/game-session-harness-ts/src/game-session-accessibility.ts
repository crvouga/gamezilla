/**
 * A game session with the keyboard alone and by listening: choosing a bot for
 * a side and starting move from control to control, and what the screen's
 * live status tells a person listening to the app.
 */

import type { GameSessionSide } from '@libs/game-session-shared-ts/game-session-state';
import { actorPage, tabTo } from '@libs/harness-ts/actor-page';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { isHiddenFromAt } from '@pkgs/a11y-shared-ts/visibility';
import { readGameSessionProbe } from './game-session-probe';
import { waitGameSessionSettled } from './game-session-ui';

/** `actor` assigns a bot to `side` using the keyboard alone. */
export const assignGameSessionBotWithKeyboard = scenarioAction({
  name: 'assignGameSessionBotWithKeyboard',
  act: async (s, actor: string, side: GameSessionSide) => {
    const probe = await readGameSessionProbe(s, actor);
    if (probe === null) throw new Error(`${actor} sees no game session`);
    const ui = await actorUi(s, actor);
    await tabTo(s, actor, `game-session-${side}-choices`);
    await ui.key('enter');
    await s.session.waitForIdle();
    await tabTo(s, actor, `game-session-${side}-bot`);
    await ui.key('enter');
    await waitGameSessionSettled(s, actor, probe.settled);
  },
});

/** `actor` starts the game session using the keyboard alone. */
export const startGameSessionWithKeyboard = scenarioAction({
  name: 'startGameSessionWithKeyboard',
  act: async (s, actor: string) => {
    const probe = await readGameSessionProbe(s, actor);
    if (probe === null) throw new Error(`${actor} sees no game session`);
    await tabTo(s, actor, 'game-session-start');
    await (await actorUi(s, actor)).key('enter');
    await waitGameSessionSettled(s, actor, probe.settled);
  },
});

/** `actor` listens to the game session as the app reads it aloud. */
export const listenToGameSession = scenarioAction({
  name: 'listenToGameSession',
  act: async (s, actor: string) => {
    await actorPage(s, actor);
  },
});

/** What the live status says to a person listening, and any ACT failures. */
export async function readGameSessionHeard(s: ProductHarness, actor: string) {
  const page = await actorPage(s, actor);
  const status = page.querySelector('[data-testid="game-session-status"]');
  if (
    status === null ||
    isHiddenFromAt(status) ||
    status.getAttribute('role') !== 'status' ||
    status.getAttribute('aria-live') !== 'polite'
  )
    throw new Error('the game session status is not announced');
  return {
    description: status.textContent ?? '',
    problems: auditTree(page).map(formatFailure),
  };
}
