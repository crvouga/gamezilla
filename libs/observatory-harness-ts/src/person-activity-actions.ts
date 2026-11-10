/**
 * What a person does in the app while the User Observatory watches: looking
 * for a multiplayer opponent for a game, by the game's name.
 */
import { seekGameOpponent } from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { syntheticGame } from '@libs/synthetic-population-harness-ts/synthetic-game-actions';

const WAITING_MS = 15_000;

/** The person looks for a multiplayer opponent for a game, from a space. */
export const lookForOpponent = scenarioAction({
  name: 'lookForOpponent',
  act: async (s, actor: string, game: string) => {
    await Promise.resolve(
      seekGameOpponent.act(s, actor, syntheticGame(game).shared.id)
    );
    await (await actorUi(s, actor))
      .get('multiplayer-waiting')
      .expect.visible({ timeoutMs: WAITING_MS });
  },
});
