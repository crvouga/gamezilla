import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFromSpace,
  openPuzzleReview,
  playUntilSolved,
  playWrongPuzzleMove,
  readActivePuzzleId,
  readGameLogRowTitle,
  readStatsElo,
  returnToTabs,
  signInWithDev,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

const DEFAULT_ELO = 1200;
/** Narrow a nullable read result; failing loudly beats a silent `!`. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function enterPuzzle(s: Awaited<ReturnType<typeof openSim>>) {
  await s.apply(signInWithDev, 'alice');
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

  test('leaving mid-attempt forfeits it: Abandoned row and Elo drop', async () => {
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
    expect(title).toMatch(/^Abandoned/);
  });
});
