import { givenGameSpace } from '@libs/game-matchmaking-harness/opponent-seeking';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { selectChessGame } from './chess-game-choice';

/** Given setup: supply the space required for all multiplayer play. */
export const givenMultiplayerSpace = scenarioAction({
  name: 'givenMultiplayerSpace',
  act: async (s, actor: string) => {
    await Promise.resolve(givenGameSpace.act(s, actor));
    const ui = await actorUi(s, actor);
    if (await ui.get('game-menu-chess').isVisible())
      await Promise.resolve(selectChessGame.act(s, actor));
    await s.session.waitForIdle();
  },
});
