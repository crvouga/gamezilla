/**
 * The shared history of a game played by more than two people records the
 * finished game once, with its result counted for every participant as the
 * game's own rules decided it.
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import {
  gameHistoryStatistics,
  openGameHistory,
} from '@libs/game-session-harness-ts/game-history-actions';
import { openConformanceHarness } from '../../conformance-world';
import { forEveryTurnGame } from '../game-suite';

forEveryTurnGame(
  import.meta.path,
  (game) => {
    test('a finished game of more than two people counts its result once for each of them', async () => {
      await using s = await openConformanceHarness(
        `${game.shared.id}-multi-seat-history`
      );
      // An earlier history through the room boundary: a game of many moves
      // (a whole Hearts game) finishes in seconds.
      await s.apply(establishCustomGame, game.shared.id, {
        history: game.fixtures.firstSideVictory,
      });
      // The first side won its known victory; everyone else lost it.
      await s.apply(openGameHistory, 'alice');
      const winner = await s.read(gameHistoryStatistics, 'alice');
      expect([winner.wins, winner.losses, winner.draws]).toEqual([1, 0, 0]);
      await s.apply(openGameHistory, 'bob');
      const other = await s.read(gameHistoryStatistics, 'bob');
      expect([other.wins, other.losses, other.draws]).toEqual([0, 1, 0]);
    }, 60_000);
  },
  ['custom-games', 'more than two seats']
);
