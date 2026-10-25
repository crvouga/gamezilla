/**
 * What a matched-game scenario is given, set up directly where no person
 * could reach it in time — the fixture helpers a game's own harness may use
 * (`gameApi`). Each writes through the framework's own fixture transaction
 * and publishes the game to both people's devices, so the next move, flag
 * fall or result still goes through the real commands and sweep.
 */

import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  awaitGameMatch,
  givenOpponentSearch,
  pairGameOpponents,
  publishMultiplayerFixture,
} from './multiplayer-fixtures';
import { multiplayerFixture } from './multiplayer-fixtures-core';
import { openFindingAnOpponent } from './opponent-seeking';

/** Pair two real accounts using the registered choice, with the first on White. */
export const pairGamePlayers = scenarioAction({
  name: 'pairGamePlayers',
  act: async (s, gameId: string, first: string, second: string) => {
    const matched = s.harness.composition.app.turnGames.capability(
      gameId,
      'matchmaking'
    );
    if (matched === undefined)
      throw new Error(`${gameId} offers no finding an opponent`);
    for (const person of [first, second]) {
      await Promise.resolve(signInWithGoogle.act(s, person));
      await Promise.resolve(createSpace.act(s, person));
      await Promise.resolve(openFindingAnOpponent.act(s, person, gameId));
      await Promise.resolve(
        givenOpponentSearch.act(s, person, defaultMatchChoice(matched))
      );
      await s.session.advanceTime(1);
    }
    await Promise.resolve(awaitGameMatch.act(s, first, second, true));
  },
});

/**
 * A legal pre-existing position after both first moves, the actor to move,
 * with this much time on each clock; the next move still uses the real
 * command.
 */
export const givenMultiplayerPosition = scenarioAction({
  name: 'givenMultiplayerPosition',
  act: (
    s,
    actor: string,
    position: {
      readonly gameId: string;
      readonly fen: string;
      readonly clockMs?: number;
    }
  ) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const { gameId, fen, clockMs } = position;
      const nowMs = env.now().getTime();
      await tx.run(sql`UPDATE chess_multiplayer_games SET fen = ${fen}, pgn = ${''},
        turn = ${env.actorId}, revision = ${2}, clock_at_ms = ${nowMs},
        white_ms = COALESCE(${clockMs ?? null}, white_ms), black_ms = COALESCE(${clockMs ?? null}, black_ms),
        updated_at = ${env.now().toISOString()} WHERE id = ${gameId}`);
      return publishMultiplayerFixture(tx, gameId, env);
    }),
});

/** Time left on one side's clock, that side to move, its clock running from now. */
export const givenMultiplayerClock = scenarioAction({
  name: 'givenMultiplayerClock',
  act: (
    s,
    actor: string,
    clock: {
      readonly gameId: string;
      readonly side: 'white' | 'black';
      readonly ms: number;
    }
  ) =>
    multiplayerFixture(s, actor, async (tx, env) => {
      const { gameId, side, ms } = clock;
      const nowMs = env.now().getTime();
      await tx.run(
        side === 'white'
          ? sql`UPDATE chess_multiplayer_games SET white_ms = ${ms}, clock_at_ms = ${nowMs} WHERE id = ${gameId}`
          : sql`UPDATE chess_multiplayer_games SET black_ms = ${ms}, clock_at_ms = ${nowMs} WHERE id = ${gameId}`
      );
      return publishMultiplayerFixture(tx, gameId, env);
    }),
});

/**
 * Matchmaking's formation pass pairs up everyone waiting who can be paired,
 * whatever the game and however many it seats, as the scheduled pass does.
 */
export const pairUpWaitingPeople = scenarioAction({
  name: 'pairUpWaitingPeople',
  act: (s, actor?: string) => pairGameOpponents.act(s, actor),
});
