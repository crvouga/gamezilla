import { describe, expect, test } from 'bun:test';
import {
  nextForwardSolveIdx,
  prevSolveIdx,
  resolveSeekSolveIdx,
} from '@libs/game-puzzle-shared/step';

/**
 * Stepping through a puzzle's line by index, the same for every game: one
 * move back at a time, forward never past the furthest move reached, and a
 * seek only to a move already reached. (Each game's line replayed to those
 * positions is `conformance/puzzles/puzzle-playback` in @libs/games-harness.)
 */
describe('stepping through a line', () => {
  test('prevSolveIdx rewinds one ply at a time', () => {
    expect(prevSolveIdx(1)).toBeNull();
    expect(prevSolveIdx(2)).toBe(1);
    expect(prevSolveIdx(3)).toBe(2);
    expect(prevSolveIdx(4)).toBe(3);
    expect(prevSolveIdx(5)).toBe(4);
  });

  test('nextForwardSolveIdx never past furthest', () => {
    expect(
      nextForwardSolveIdx({
        solveIdx: 1,
        furthestSolveIdx: 5,
        tokensLength: 4,
      })
    ).toBe(2);
    expect(
      nextForwardSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        tokensLength: 4,
      })
    ).toBe(4);
    expect(
      nextForwardSolveIdx({
        solveIdx: 4,
        furthestSolveIdx: 4,
        tokensLength: 4,
      })
    ).toBeNull();
  });

  test('resolveSeekSolveIdx clamps to furthest and skips current', () => {
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 1,
      })
    ).toBe(1);
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 3,
      })
    ).toBeNull();
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 0,
      })
    ).toBeNull();
    expect(
      resolveSeekSolveIdx({
        solveIdx: 3,
        furthestSolveIdx: 4,
        targetSolveIdx: 5,
      })
    ).toBeNull();
  });
});
