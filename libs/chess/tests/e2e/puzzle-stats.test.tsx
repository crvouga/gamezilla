// goal:chess-puzzles:2
// goal:chess-puzzles:11
import { describe, expect, test } from 'bun:test';
import {
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFromSpace,
  openPuzzleReview,
  playUntilSolved,
  playWrongPuzzleMove,
} from '@libs/chess/sim/chess-actions';
import {
  readActivePuzzleId,
  readGameLogRowTitle,
  readStatsElo,
} from '@libs/chess/sim/chess-puzzle-ui';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-chess-sim';

const DEFAULT_ELO = 1500;
/** Narrow a nullable read result; failing loudly beats a silent `!`. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function enterPuzzle(s: Awaited<ReturnType<typeof openSim>>) {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
}

describe('chess puzzle stats', () => {
  test('a solve raises Elo and lands in the game log; review opens the board', async () => {
    await using s = await openSim('chess-puzzle-stats-solve');
    await enterPuzzle(s);
    const puzzleId = required(
      await s.read(readActivePuzzleId, 'alice'),
      'active puzzle'
    );

    await s.apply(playUntilSolved, 'alice');
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');

    const elo = required(await s.read(readStatsElo, 'alice'), 'stats elo');
    expect(elo).toBeGreaterThan(DEFAULT_ELO);
    const title = await s.read(readGameLogRowTitle, 'alice', puzzleId);
    expect(title).toMatch(/^Solved/);

    await s.apply(openPuzzleReview, 'alice', puzzleId);
  });

  // §5: the wrong move itself is the loss (recorded once, rating drops at
  // once); leaving afterwards adds nothing.
  test('a wrong move drops Elo and logs a Failed row', async () => {
    await using s = await openSim('chess-puzzle-stats-abandon');
    await enterPuzzle(s);
    const puzzleId = required(
      await s.read(readActivePuzzleId, 'alice'),
      'active puzzle'
    );

    await s.apply(playWrongPuzzleMove, 'alice');
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');

    const elo = required(await s.read(readStatsElo, 'alice'), 'stats elo');
    expect(elo).toBeLessThan(DEFAULT_ELO);
    const title = await s.read(readGameLogRowTitle, 'alice', puzzleId);
    expect(title).toMatch(/^Failed/);
  });
});
