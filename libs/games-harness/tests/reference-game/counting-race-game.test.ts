/**
 * The extension contract, exercised end to end with a game no shared code
 * knows, in a world of its own: the shared menu offers exactly what it
 * declares, the shared custom-game screen plays it on its own board, and the
 * shared history counts its result. (Beside the registered games, the same
 * game also runs every shared specification and suite it offers.)
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness/custom-game-moves';
import { customGameView } from '@libs/game-session-harness/custom-game-probe';
import {
  gameHistoryStatistics,
  openGameHistory,
} from '@libs/game-session-harness/game-history-actions';
import {
  goBackInGame,
  offeredGameChoices,
} from '@libs/game-session-harness/game-navigation';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import { COUNTING_RACE_GAME } from './counting-race-game';

const RACE_SYSTEM = gameSystem('counting-race', [COUNTING_RACE_GAME]);

test('a game registered only through the public contracts is offered, played and counted by the shared platform', async () => {
  await using s = await openGameHarness(RACE_SYSTEM, 'counting-race-plugin');
  await s.apply(establishCustomGame, 'counting-race', {
    moves: COUNTING_RACE_GAME.fixtures.firstSideVictory.slice(0, -1),
  });
  await s.apply(makeCustomGameMove, 'alice', 'counting-race', 'advance');
  const finished = (await s.read(customGameView, 'alice')).current;
  expect(finished?.status).toBe('completed');
  expect(finished?.outcome).toBe('white wins by finish line');

  await s.apply(openGameHistory, 'alice');
  const history = await s.read(gameHistoryStatistics, 'alice');
  expect([history.wins, history.losses, history.draws]).toEqual([1, 0, 0]);

  // What the game does not declare is absent, not disabled.
  await s.apply(goBackInGame, 'alice');
  expect(await s.read(offeredGameChoices, 'alice')).toEqual([
    'custom-game',
    'history',
  ]);
}, 120_000);
