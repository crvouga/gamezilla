import { describe, expect, test } from 'bun:test';
import {
  leavePuzzleToChessMenu,
  openChessStatsScreen,
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
  skipPuzzle,
} from '@libs/chess/sim/chess-actions';
import {
  readActivePuzzleId,
  readGameLogRowTitle,
  readPuzzleSpectator,
  readPuzzleStatus,
  readPuzzleStatusKind,
} from '@libs/chess/sim/chess-puzzle-ui';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-chess-sim';

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

describe('chess puzzle status and clock', () => {
  test('started clock ticks then freezes on solve', async () => {
    await using s = await openSim('chess-puzzle-skip-clock-tick');
    await enterPuzzle(s);

    expect(await s.read(readPuzzleStatusKind, 'alice')).toBe('started');
    await s.advanceTime(65_000);
    const early = await s.read(readPuzzleSpectator, 'alice');
    expect(early?.clockMs ?? 0).toBeGreaterThanOrEqual(60_000);

    await s.advanceTime(5_000);
    const later = await s.read(readPuzzleSpectator, 'alice');
    expect(later?.clockMs ?? 0).toBeGreaterThan(early?.clockMs ?? 0);

    await s.apply(playUntilSolved, 'alice');
    const solved = await s.read(readPuzzleSpectator, 'alice');
    expect(solved?.statusKind).toBe('solved');

    await s.advanceTime(30_000);
    const frozen = await s.read(readPuzzleSpectator, 'alice');
    expect(frozen?.clockMs).toBe(solved?.clockMs);
  });

  test('skip is terminal and unrated', async () => {
    await using s = await openSim('chess-puzzle-skip-terminal');
    await enterPuzzle(s);
    const puzzleId = required(
      await s.read(readActivePuzzleId, 'alice'),
      'active puzzle'
    );

    await s.apply(skipPuzzle, 'alice');
    expect(await s.read(readPuzzleStatus, 'alice')).toBe('skipped');
    expect(await s.read(readPuzzleStatusKind, 'alice')).toBe('skipped');

    await s.apply(leavePuzzleToChessMenu, 'alice');
    await s.apply(openChessStatsScreen, 'alice');
    expect(await s.read(readGameLogRowTitle, 'alice', puzzleId)).toMatch(
      /^Abandoned/
    );
  });

  test('Next after a skip loads a fresh puzzle', async () => {
    await using s = await openSim('chess-puzzle-skip-next');
    await enterPuzzle(s);

    await s.apply(skipPuzzle, 'alice');
    await s.apply(pressPuzzleNext, 'alice');
    expect(await s.read(readPuzzleStatusKind, 'alice')).not.toBe('skipped');
  });
});
