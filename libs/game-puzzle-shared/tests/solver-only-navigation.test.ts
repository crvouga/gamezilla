import { expect, test } from 'bun:test';
import {
  puzzleNavFromState,
  resolvePuzzleNavTarget,
} from '@libs/game-puzzle-shared/puzzle-nav';

// regression: solo-puzzle-navigation-excludes-start
test('the first accepted solo action can navigate back to index zero', () => {
  const at = { solveIdx: 1, furthestSolveIdx: 1, firstSolveIdx: 0 as const };
  expect(
    puzzleNavFromState({ ...at, status: 'solving', moves: 'take2 take2' })
  ).toEqual({
    atFrontier: true,
    canGoBack: true,
    canGoForward: false,
  });
  expect(resolvePuzzleNavTarget({ ...at, intent: 'back' })).toBe(0);
  expect(resolvePuzzleNavTarget({ ...at, intent: 'start' })).toBe(0);
});

test('an untouched solo starting position is reached and has no earlier action', () => {
  const at = { solveIdx: 0, furthestSolveIdx: 0, firstSolveIdx: 0 as const };
  expect(
    puzzleNavFromState({ ...at, status: 'solving', moves: 'take2 take2' })
  ).toEqual({
    atFrontier: true,
    canGoBack: false,
    canGoForward: false,
  });
  expect(resolvePuzzleNavTarget({ ...at, intent: 'start' })).toBeNull();
  expect(resolvePuzzleNavTarget({ ...at, intent: 'forward' })).toBeNull();
});
