import { expect, test } from 'bun:test';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import { solveKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import { writeKnownPuzzlePool } from '@libs/game-session-harness/puzzle-pool';
import {
  choosePuzzleLineMove,
  leavePuzzleForGameChoices,
  openGamePuzzles,
  readPuzzleProbe,
} from '@libs/game-session-harness/puzzle-screen';
import {
  attemptGoBackToGameChoice,
  readSpaceView,
} from '@libs/game-session-harness/space-game-choice';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { SOLO_COUNT_GAME } from './solo-count-game';

const SYSTEM = gameSystem('solo-navigation', [SOLO_COUNT_GAME], {
  knownPuzzles: true,
});

// regression: solver-only-line-selection-negative-ply
test('selecting zero on the shared solo line reaches the supplied position', async () => {
  await using s = await openGameHarness(SYSTEM, 'solo-select-zero');
  const id = SOLO_COUNT_GAME.shared.id;
  await s.apply(writeKnownPuzzlePool, id, [{ id: 'solo-count/two-twos' }]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  await s.apply(choosePuzzleLineMove, 'alice', 0);
  expect((await s.read(readPuzzleProbe, 'alice'))?.solveIdx).toBe(0);
  await s.apply(solveKnownPuzzle, 'alice', id);
  await s.apply(choosePuzzleLineMove, 'alice', 0);
  const probe = await s.read(readPuzzleProbe, 'alice');
  expect(probe?.solveIdx).toBe(0);
  expect(probe?.status).toBe('solved');
}, 120_000);

// regression: puzzle-only-menu-requires-custom-game
test('the shared space view recognizes puzzle-only choices and returns to the game list', async () => {
  await using s = await openGameHarness(SYSTEM, 'solo-space-view');
  const id = SOLO_COUNT_GAME.shared.id;
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  await s.apply(leavePuzzleForGameChoices, 'alice');
  expect(await s.read(readSpaceView, 'alice', id)).toBe('game');
  await s.apply(attemptGoBackToGameChoice, 'alice', id);
  expect(await s.read(readSpaceView, 'alice', id)).toBe('choice');
}, 120_000);
