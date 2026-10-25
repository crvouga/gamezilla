import { givenMultiplayerPosition } from '@libs/game-matchmaking-harness-ts/matched-game-fixtures';
import {
  awaitGameMatch,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness-ts/multiplayer-fixtures';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { isTurnHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { actorUi, pollUntil } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { configureUsername } from '@libs/synthetic-population-shared-ts/application-actions';
import {
  givenSyntheticGameSpace,
  openSyntheticGame,
  syntheticGame,
  syntheticGameView,
} from './synthetic-game-actions';

/** Keep the existing short turn-game fixture; continuous games begin from their real initial play. */
async function preparePosition(
  s: ProductHarness,
  game: HarnessGame,
  gameId: string
) {
  if (!isTurnHarnessGame(game)) return null;
  const victory = game.fixtures.firstSideVictory;
  const fen = game.shared.turnGame.rules.replay(victory, victory.length - 1);
  await Promise.resolve(
    givenMultiplayerPosition.act(s, 'cedar', { gameId, fen })
  );
  return fen;
}

/** Cedar's real account and a person use the registered matchmaking choice. */
export async function prepareSyntheticMatch(s: ProductHarness, label: string) {
  const game = syntheticGame(label);
  const matched = game.shared.capabilities.matchmaking;
  if (matched === undefined) throw new Error(`${label} offers no matchmaking`);
  await Promise.resolve(signInWithGoogle.act(s, 'bob'));
  await pollUntil(s, async () => (await signedInAccountOf(s, 'bob')) ?? null, {
    maxMs: 20_000,
    description: "Bob's account is ready",
  });
  await configureUsername(await actorUi(s, 'bob'), 'bob');
  for (const actor of ['cedar', 'bob']) {
    await Promise.resolve(givenSyntheticGameSpace.act(s, actor, label));
    await Promise.resolve(
      givenOpponentSearch.act(s, actor, defaultMatchChoice(matched))
    );
  }
  await Promise.resolve(awaitGameMatch.act(s, 'cedar', 'bob', true));
  await Promise.resolve(openSyntheticGame.act(s, 'cedar', label));
  const gameId = await pollUntil(
    s,
    async () => (await syntheticGameView(s, 'cedar')).gameId,
    {
      maxMs: 10_000,
      description: 'Cedar sees the assigned multiplayer game',
    }
  );
  const fen = await preparePosition(s, game, gameId);
  await Promise.resolve(openSyntheticGame.act(s, 'cedar', label));
  await pollUntil(
    s,
    async () => {
      const board = await syntheticGameView(s, 'cedar');
      return board.gameId === gameId &&
        (fen === null || board.position === fen) &&
        board.canMove
        ? true
        : null;
    },
    { maxMs: 15_000, description: 'Cedar sees its assigned game ready to play' }
  );
}
