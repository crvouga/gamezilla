import { describe, expect, test } from 'bun:test';
import type { PuzzleNavIntent } from '@libs/game-puzzle-shared/puzzle-nav';
import {
  isPuzzleSeekAnimated,
  PUZZLE_NAV_INTENT,
  PUZZLE_SWIPE_THRESHOLD_PX,
  puzzleNavIntentFromKey,
  puzzleNavIntentFromSwipe,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared/puzzle-nav';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const SEED = 20260919;

describe('§7 nav keymap', () => {
  test('arrows step, Home / End jump', () => {
    expect(puzzleNavIntentFromKey('ArrowLeft')).toBe('back');
    expect(puzzleNavIntentFromKey('ArrowRight')).toBe('forward');
    expect(puzzleNavIntentFromKey('ArrowUp')).toBe('back');
    expect(puzzleNavIntentFromKey('ArrowDown')).toBe('forward');
    expect(puzzleNavIntentFromKey('Home')).toBe('start');
    expect(puzzleNavIntentFromKey('End')).toBe('end');
  });

  test('every other key is left alone', () => {
    for (const key of ['a', 'Enter', 'Escape', 'Tab', ' ', 'PageUp']) {
      expect(puzzleNavIntentFromKey(key)).toBeNull();
    }
  });
});

describe('§7 swipe map', () => {
  test('a left drag goes forward, a right drag goes back', () => {
    expect(puzzleNavIntentFromSwipe({ dx: -80, dy: 2 })).toBe('forward');
    expect(puzzleNavIntentFromSwipe({ dx: 80, dy: 2 })).toBe('back');
  });

  test('short travel is a tap, not a swipe', () => {
    expect(
      puzzleNavIntentFromSwipe({ dx: PUZZLE_SWIPE_THRESHOLD_PX - 1, dy: 0 })
    ).toBeNull();
    expect(puzzleNavIntentFromSwipe({ dx: 0, dy: 0 })).toBeNull();
  });

  test('a mostly-vertical drag is a scroll, not a swipe', () => {
    expect(puzzleNavIntentFromSwipe({ dx: 40, dy: 90 })).toBeNull();
    expect(puzzleNavIntentFromSwipe({ dx: -40, dy: -90 })).toBeNull();
  });

  test('non-finite travel never scrubs', () => {
    expect(puzzleNavIntentFromSwipe({ dx: Number.NaN, dy: 0 })).toBeNull();
    expect(
      puzzleNavIntentFromSwipe({ dx: 100, dy: Number.POSITIVE_INFINITY })
    ).toBeNull();
  });
});

describe('§7 seek targets', () => {
  test('start and end land on the ends of the reached line', () => {
    const at = { solveIdx: 3, furthestSolveIdx: 5, firstSolveIdx: 1 as const };
    expect(resolvePuzzleNavTarget({ intent: 'start', ...at })).toBe(1);
    expect(resolvePuzzleNavTarget({ intent: 'end', ...at })).toBe(5);
  });

  test('steps move exactly one ply', () => {
    const at = { solveIdx: 3, furthestSolveIdx: 5, firstSolveIdx: 1 as const };
    expect(resolvePuzzleNavTarget({ intent: 'back', ...at })).toBe(2);
    expect(resolvePuzzleNavTarget({ intent: 'forward', ...at })).toBe(4);
  });

  test('an intent that is already satisfied is a no-op', () => {
    expect(
      resolvePuzzleNavTarget({
        firstSolveIdx: 1,
        intent: 'start',
        solveIdx: 1,
        furthestSolveIdx: 5,
      })
    ).toBeNull();
    expect(
      resolvePuzzleNavTarget({
        firstSolveIdx: 1,
        intent: 'end',
        solveIdx: 5,
        furthestSolveIdx: 5,
      })
    ).toBeNull();
    expect(
      resolvePuzzleNavTarget({
        firstSolveIdx: 1,
        intent: 'back',
        solveIdx: 1,
        furthestSolveIdx: 5,
      })
    ).toBeNull();
    expect(
      resolvePuzzleNavTarget({
        firstSolveIdx: 1,
        intent: 'forward',
        solveIdx: 5,
        furthestSolveIdx: 5,
      })
    ).toBeNull();
  });

  test('nothing reached yet means nothing to seek', () => {
    expect(
      resolvePuzzleNavTarget({
        firstSolveIdx: 1,
        intent: 'end',
        solveIdx: 0,
        furthestSolveIdx: 0,
      })
    ).toBeNull();
  });

  test('a target never leaves the reached line (seeded)', () => {
    const intents: readonly PuzzleNavIntent[] = [
      PUZZLE_NAV_INTENT.start,
      PUZZLE_NAV_INTENT.back,
      PUZZLE_NAV_INTENT.forward,
      PUZZLE_NAV_INTENT.end,
    ];
    assertProperty(
      'a target never leaves the reached line (seeded)',
      fc.property(
        fc.constantFrom<0 | 1>(0, 1),
        fc.constantFrom(...intents),
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 40 }),
        (firstSolveIdx, intent, solveIdx, furthestSolveIdx) => {
          const target = resolvePuzzleNavTarget({
            firstSolveIdx,
            intent,
            solveIdx,
            furthestSolveIdx,
          });
          if (target === null) return true;
          return (
            target >= firstSolveIdx &&
            target <= furthestSolveIdx &&
            target !== solveIdx
          );
        }
      ),
      { seed: SEED }
    );
  });
});

describe('§7 animate vs snap', () => {
  test('one ply either way animates', () => {
    expect(isPuzzleSeekAnimated(3, 4)).toBe(true);
    expect(isPuzzleSeekAnimated(3, 2)).toBe(true);
  });

  test('a jump snaps', () => {
    expect(isPuzzleSeekAnimated(5, 1)).toBe(false);
    expect(isPuzzleSeekAnimated(1, 6)).toBe(false);
    expect(isPuzzleSeekAnimated(3, 3)).toBe(false);
  });
});
