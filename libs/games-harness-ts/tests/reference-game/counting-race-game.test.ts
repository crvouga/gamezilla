/**
 * The extension contract, exercised end to end with a game no shared code
 * knows, in a world of its own: the shared menu offers exactly what it
 * declares, the shared custom-game screen plays it on its own board, and the
 * shared history counts its result. (Beside the registered games, the same
 * game also runs every shared specification and suite it offers.)
 */

import { expect, test } from 'bun:test';
import { establishCustomGame } from '@libs/game-session-harness-ts/custom-game-lineup';
import { makeCustomGameMove } from '@libs/game-session-harness-ts/custom-game-moves';
import { customGameView } from '@libs/game-session-harness-ts/custom-game-probe';
import {
  gameHistoryStatistics,
  openGameHistory,
} from '@libs/game-session-harness-ts/game-history-actions';
import {
  goBackInGame,
  offeredGameChoices,
} from '@libs/game-session-harness-ts/game-navigation';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness-ts/game-system';
import { COUNTING_RACE_GAME } from './counting-race-game';

const RACE_SYSTEM = gameSystem('counting-race', [COUNTING_RACE_GAME]);

test('a game registered only through the public contracts is offered, played and counted by the shared platform', async () => {
  await using s = await openGameHarness(RACE_SYSTEM);
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

  // A game keeping played games and puzzles has its history behind History
  // and stats: Back from the games' history is that hub, the puzzle stats
  // beside it.
  await s.apply(goBackInGame, 'alice');
  expect(await s.read(offeredGameChoices, 'alice')).toEqual(['stats']);

  // What the game does not declare is absent, not disabled: no finding an
  // opponent; its puzzles are offered, their stats behind History and stats.
  await s.apply(goBackInGame, 'alice');
  expect(await s.read(offeredGameChoices, 'alice')).toEqual([
    'custom-game',
    'history',
    'puzzle',
  ]);
}, 120_000);
