// goal:chess-puzzles:9
import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  isPuzzleSolved,
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFromSpace,
  playUntilSolved,
  playWrongPuzzleMove,
  readActivePuzzleId,
  readGameLogRowTitle,
  readPuzzleHintStage,
  readPuzzleStatus,
  requestPuzzleHint,
  retryPuzzle,
  returnToTabs,
  revealPuzzleSolution,
  signInWithGoogle,
} from '../src/sim';
import type { OpenSim } from '../src/test/setup/open-sim';
import { openSim } from '../src/test/setup/open-sim';

/** Narrow a nullable read result; failing loudly beats a silent `!`. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what}`);
  }
  return value;
}

async function enterPuzzle(s: OpenSim) {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(returnToTabs, 'alice');
  await s.apply(createSpace, 'alice');
  await s.apply(openPuzzleFromSpace, 'alice');
}

describe('chess puzzle controls', () => {
  test('wrong move → Retry reverts the ply → solve', async () => {
    await using s = await openSim('chess-puzzle-wrong-retry');
    await enterPuzzle(s);

    await s.apply(playWrongPuzzleMove, 'alice');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('wrong');

    await s.apply(retryPuzzle, 'alice');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('solving');

    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(true);
  });

  test('hint highlights, second hint reveals the solution, board stays solvable', async () => {
    await using s = await openSim('chess-puzzle-hint-solution');
    await enterPuzzle(s);
    expect(await s.read(readPuzzleHintStage, 'alice')).toBe('none');

    await s.apply(requestPuzzleHint, 'alice');
    expect(await s.read(readPuzzleHintStage, 'alice')).toBe('highlight');

    await s.apply(revealPuzzleSolution, 'alice', 'hint');
    expect(await s.read(readPuzzleHintStage, 'alice')).toBe('solution');

    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(true);
  });

  test('Solution is offered after a wrong move', async () => {
    await using s = await openSim('chess-puzzle-wrong-solution');
    await enterPuzzle(s);

    await s.apply(playWrongPuzzleMove, 'alice');
    await s.apply(revealPuzzleSolution, 'alice', 'solution');
    expect(await s.read(readPuzzleHintStage, 'alice')).toBe('solution');

    await s.apply(retryPuzzle, 'alice');
    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(true);
  });

  // §5: the first wrong move is the attempt's outcome; solving it after a
  // retry never re-rates it, so the log keeps the loss.
  test('a wrong move then Retry then solve still logs as Failed', async () => {
    await using s = await openSim('chess-puzzle-wrong-retry-scored');
    await enterPuzzle(s);
    const puzzleId = required(
      await s.read(readActivePuzzleId, 'alice'),
      'active puzzle'
    );

    await s.apply(playWrongPuzzleMove, 'alice');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('wrong');

    await s.apply(retryPuzzle, 'alice');
    await s.apply(playUntilSolved, 'alice');
    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await s.read(readGameLogRowTitle, 'alice', puzzleId)).toMatch(
      /^Failed/
    );
  });
});
