import { describe, expect, test } from 'bun:test';
import {
  createSpace,
  isPuzzleSolved,
  openPuzzleFromSpace,
  playUntilSolved,
  playWrongPuzzleMove,
  readPuzzleHintStage,
  readPuzzleStatus,
  requestPuzzleHint,
  retryPuzzle,
  returnToTabs,
  revealPuzzleSolution,
  signInWithDev,
} from '../src/sim';
import { openSim } from '../src/test/setup/open-sim';

async function enterPuzzle(s: Awaited<ReturnType<typeof openSim>>) {
  await s.apply(signInWithDev, 'alice');
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
});
