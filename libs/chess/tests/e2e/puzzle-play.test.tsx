// goal:chess-puzzles:1
import { describe, expect, test } from 'bun:test';
import {
  openPuzzleFromSpace,
  playUntilSolved,
  pressPuzzleNext,
} from '@libs/chess/sim/chess-actions';
import { isPuzzleSolved } from '@libs/chess/sim/chess-puzzle-ui';
import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import { createSpace } from '@libs/spaces/sim/space-actions';
import { openSim } from './support/open-chess-sim';

describe('chess puzzle play', () => {
  test('host solves a seeded mate-in-1 via board drag', async () => {
    await using s = await openSim('chess-puzzle-play');

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    await s.apply(playUntilSolved, 'alice');
    expect(await s.read(isPuzzleSolved, 'alice')).toBe(true);
  });

  test('next never repeats the active puzzle', async () => {
    await using s = await openSim('chess-puzzle-next-different');

    await s.apply(signInWithGoogle, 'alice');
    await s.apply(returnToTabs, 'alice');
    await s.apply(createSpace, 'alice');
    await s.apply(openPuzzleFromSpace, 'alice');
    // Pass 1: solve, then Next — standing nextPuzzleDifferent asserts change.
    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNext, 'alice');
    // Pass 2: repeat — never the same puzzle twice in a row.
    await s.apply(playUntilSolved, 'alice');
    await s.apply(pressPuzzleNext, 'alice');
  });
});
