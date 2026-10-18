import { timeControlKey } from '@libs/game-matchmaking-shared/time-control';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { forgetMultiplayerReply } from './multiplayer-commands';
import { clockChoiceOf } from './multiplayer-search-ui';
import { openFindingAnOpponent } from './opponent-seeking';

/**
 * The person, with the keyboard alone, seeks an opponent for `gameId` at
 * `timeControl` (in the game's clock namespace) from finding an opponent:
 * Enter on the clock choice, then Enter on finding.
 */
export const seekOpponentWithKeyboard = scenarioAction({
  name: 'seekOpponentWithKeyboard',
  act: async (s, actor: string, gameId: string, timeControl: string) => {
    await Promise.resolve(openFindingAnOpponent.act(s, actor, gameId));
    const ui = await actorUi(s, actor);
    forgetMultiplayerReply(s, actor);
    await ui
      .get(
        `multiplayer-time-control-${timeControlKey(clockChoiceOf(timeControl))}`
      )
      .key('enter');
    await ui.get('multiplayer-find').wait('enabled');
    await ui.get('multiplayer-find').key('enter');
    await s.session.waitForIdle();
  },
});

/** The person presses one of the matched game's controls with Enter. */
export const pressControlWithKeyboard = scenarioAction({
  name: 'pressControlWithKeyboard',
  act: async (s, actor: string, gameId: string, testId: string) => {
    await Promise.resolve(openFindingAnOpponent.act(s, actor, gameId));
    const ui = await actorUi(s, actor);
    await ui.get(testId).key('enter');
    await s.session.waitForIdle();
  },
});

/**
 * The person resigns or aborts the matched game with the keyboard alone:
 * Enter on the control, Enter to confirm, Enter to close the confirmation.
 */
export const confirmWithKeyboard = scenarioAction({
  name: 'confirmWithKeyboard',
  act: async (s, actor: string, gameId: string, kind: 'resign' | 'abort') => {
    await Promise.resolve(openFindingAnOpponent.act(s, actor, gameId));
    const ui = await actorUi(s, actor);
    await ui.get(`multiplayer-${kind}`).key('enter');
    await ui.get('multiplayer-confirm').key('enter');
    await ui.get('multiplayer-dismiss').expect.visible();
    await ui.get('multiplayer-dismiss').key('enter');
    await s.session.waitForIdle();
  },
});
