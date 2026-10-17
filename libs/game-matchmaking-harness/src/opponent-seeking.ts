import { DEFAULT_TIME_CONTROL } from '@libs/game-matchmaking-shared/time-control';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { backToTabs } from '@libs/harness/shell-actions';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { Handles } from '@libs/test-ids-shared/handles';
import { multiplayerView } from './multiplayer-reads';
import { requestGameOpponent } from './multiplayer-search-ui';

/**
 * `actor` seeks an opponent for `gameId` from their own space, through the
 * game's shared choices, whichever game it is.
 */
export const seekGameOpponent = scenarioAction({
  name: 'seekGameOpponent',
  act: async (
    s,
    actor: string,
    gameId: string,
    timeControl: string = DEFAULT_TIME_CONTROL
  ) => {
    await Promise.resolve(signInWithGoogle.act(s, actor));
    await Promise.resolve(backToTabs.act(s, actor));
    await Promise.resolve(createSpace.act(s, actor));
    const ui = await actorUi(s, actor);
    await ui.get(Handles.gameMenu(gameId)).tap();
    await ui.get(Handles.gameChoice('multiplayer')).tap();
    await Promise.resolve(requestGameOpponent.act(s, actor, timeControl));
  },
});

/** `actor` stops seeking from the shared waiting controls. */
export const stopSeekingOpponent = scenarioAction({
  name: 'stopSeekingOpponent',
  act: async (s, actor: string) => {
    await (await actorUi(s, actor)).get('multiplayer-stop').tap();
  },
});

/** What `actor` sees of their wait and the game an opponent brings. */
export async function opponentSearchView(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  return {
    ...(await multiplayerView(s, actor)),
    waiting: await ui.get('multiplayer-waiting').isVisible(),
    board: await ui.get(Handles.multiplayerBoard).isVisible(),
  };
}

export const OPPONENT_SEEKING_ACTIONS = [seekGameOpponent, stopSeekingOpponent];
