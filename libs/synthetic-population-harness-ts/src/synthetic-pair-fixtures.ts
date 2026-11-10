/** Two Synthetic Users matched with each other, as matchmaking pairs them. */
import { givenMultiplayerPosition } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import {
  awaitGameMatch,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { playedRulesOf } from '@libs/game-session-harness-ts/played-rules';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { setPlaySetup } from './live-synthetic-users';
import {
  givenSyntheticGameSpace,
  openSyntheticGame,
  syntheticGame,
  syntheticGameView,
} from './synthetic-game-actions';
import { syntheticUserActor } from './synthetic-sign-in-actions';
import { givenSyntheticUser } from './synthetic-user-fixtures';

async function readyToMove(
  s: ProductHarness,
  actor: string,
  gameId: string,
  position: string | null
) {
  await pollUntil(
    s,
    async () => {
      await Promise.resolve(openSyntheticGame.act(s, actor));
      const board = await syntheticGameView(s, actor);
      return board.gameId === gameId &&
        (position === null || board.position === position)
        ? true
        : null;
    },
    { maxMs: 15_000, description: `${actor} sees the matched game` }
  );
}

/**
 * The two Synthetic Users, available, look for an opponent for the game and
 * are matched, the first with the first side; a turn game starts one move
 * from the first side's win, a continuous one from its real start.
 */
export const givenSyntheticPairGame = scenarioAction({
  name: 'givenSyntheticPairGame',
  act: async (s, first: string, second: string, label: string) => {
    const game = syntheticGame(label);
    const matched = game.shared.capabilities.matchmaking;
    if (matched === undefined)
      throw new Error(`${label} offers no matchmaking`);
    const actors = [syntheticUserActor(first), syntheticUserActor(second)];
    for (const name of [first, second])
      await Promise.resolve(givenSyntheticUser.act(s, name, false));
    // A strong player against a beginner: their game comes to a result.
    setPlaySetup(s, first, { persona: { skillLevel: 'strong' } });
    setPlaySetup(s, second, { persona: { skillLevel: 'beginner' } });
    for (const actor of actors) {
      await Promise.resolve(givenSyntheticGameSpace.act(s, actor, label));
      await Promise.resolve(
        givenOpponentSearch.act(s, actor, defaultMatchChoice(matched))
      );
    }
    await Promise.resolve(awaitGameMatch.act(s, actors[0]!, actors[1]!, true));
    await Promise.resolve(openSyntheticGame.act(s, actors[0]!, label));
    const gameId = await pollUntil(
      s,
      async () => (await syntheticGameView(s, actors[0]!)).gameId,
      { maxMs: 10_000, description: 'the matched game is shown' }
    );
    let position: string | null = null;
    if (isTurnHarnessGame(game)) {
      const victory = game.fixtures.firstSideVictory;
      // As the authority plays it: with the game's known private setups.
      position = playedRulesOf(game).replay(victory, victory.length - 1);
      await Promise.resolve(
        givenMultiplayerPosition.act(s, actors[0]!, { gameId, fen: position })
      );
    }
    for (const actor of actors) await readyToMove(s, actor, gameId, position);
  },
});
