import { expect, test } from 'bun:test';

import { chessPuzzleLastMove } from '@libs/chess-puzzle-shared-ts/last-move';

// regression: puzzle-last-move-unmarked — the move just played (the setup
// move 4…g6, the opponent's reply Bxd1) was not marked on the puzzle
// board, so the solver could not see what had changed. The platform now
// hands the board the line's last action, and chess marks its squares.
test("the line's last action marks its from and to squares", () => {
  expect(chessPuzzleLastMove('g7g6')).toEqual({ from: 'g7', to: 'g6' });
  expect(chessPuzzleLastMove('g4d1')).toEqual({ from: 'g4', to: 'd1' });
  expect(chessPuzzleLastMove('e7e8q')).toEqual({ from: 'e7', to: 'e8' });
});

test('nothing is marked without a move', () => {
  expect(chessPuzzleLastMove(null)).toBeNull();
  expect(chessPuzzleLastMove(undefined)).toBeNull();
  expect(chessPuzzleLastMove('not a move')).toBeNull();
});
