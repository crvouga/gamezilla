import { expect, test } from 'bun:test';
import {
  gameSystem,
  openGameHarness,
} from '@libs/game-session-harness/game-system';
import { solveKnownPuzzle } from '@libs/game-session-harness/puzzle-moves';
import { writeKnownPuzzlePool } from '@libs/game-session-harness/puzzle-pool';
import {
  openPuzzleReviewFromLog,
  readGameLogTitle,
  readPuzzleReview,
  showPersonalPuzzleStats,
} from '@libs/game-session-harness/puzzle-records';
import { openGamePuzzles } from '@libs/game-session-harness/puzzle-screen';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { SOLO_COUNT_GAME } from './solo-count-game';

const SYSTEM = gameSystem('solo-personal-stats', [SOLO_COUNT_GAME], {
  knownPuzzles: true,
});

// regression: puzzle-stats-require-game-wrapper
// regression: solo-personal-review-opens-at-zero
test('personal stats and review are inherited without a game-owned settings wrapper', async () => {
  expect(SOLO_COUNT_GAME.slice).toBeUndefined();
  await using s = await openGameHarness(SYSTEM, 'solo-personal-stats');
  const id = SOLO_COUNT_GAME.shared.id;
  const puzzle = 'solo-count/two-twos';
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(writeKnownPuzzlePool, id, [{ id: puzzle }]);
  await s.apply(createSpace, 'alice');
  await s.apply(openGamePuzzles, 'alice', id);
  await s.apply(solveKnownPuzzle, 'alice', id);
  await s.apply(showPersonalPuzzleStats, 'alice', id);
  expect(await s.read(readGameLogTitle, 'alice', puzzle)).toStartWith('Solved');
  await s.apply(openPuzzleReviewFromLog, 'alice', puzzle);
  expect((await s.read(readPuzzleReview, 'alice'))?.move).toBe(2);
}, 120_000);
