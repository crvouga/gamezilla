import { expect, test } from 'bun:test';
import {
  PuzzleReviewAttr,
  PuzzleReviewSought,
  puzzleReviewEventReducer,
  ReviewPuzzleSelected,
} from '@libs/game-puzzle-shared-ts/puzzle-review-selection';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';

// regression: solo-puzzle-review-cursor-zero-unset
test('the existing select-at-end payload and an explicit seek to zero remain distinct', () => {
  const selected = ReviewPuzzleSelected({
    puzzleId: 'solo-count/two-twos',
    solveIdx: 0,
  });
  expect(selected.payload).toEqual({
    puzzleId: 'solo-count/two-twos',
    solveIdx: 0,
  });
  const initial = puzzleReviewEventReducer.dispatch(
    {},
    undefined,
    selected,
    () => {
      throw new Error('Unrecognized selection');
    }
  );
  expect(PuzzleReviewAttr.selectedReviewSolveIdx.from(initial)).toBeNull();
  const sought: RoomState = puzzleReviewEventReducer.dispatch(
    initial,
    undefined,
    PuzzleReviewSought({ solveIdx: 0 }),
    () => {
      throw new Error('Unrecognized seek');
    }
  );
  expect(PuzzleReviewAttr.selectedReviewSolveIdx.from(sought)).toBe(0);
});
