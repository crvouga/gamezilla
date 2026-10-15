import { multiplayerSpaceId } from '@libs/game-matchmaking-harness/multiplayer-spaces';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import {
  createSpace,
  selectChessGame,
} from '@libs/spaces-harness/space-actions';

/** Given setup: supply the space required for all multiplayer play. */
export const givenMultiplayerSpace = scenarioAction({
  name: 'givenMultiplayerSpace',
  act: async (s, actor: string) => {
    let id = await multiplayerSpaceId(s, actor);
    if (id === null) {
      await Promise.resolve(createSpace.act(s, actor));
      id = await multiplayerSpaceId(s, actor);
    } else await s.actors.get(actor)!.openLink(`/space/${id}`);
    const ui = await actorUi(s, actor);
    if (await ui.get('game-menu-chess').isVisible())
      await Promise.resolve(selectChessGame.act(s, actor));
    await s.session.waitForIdle();
  },
});
