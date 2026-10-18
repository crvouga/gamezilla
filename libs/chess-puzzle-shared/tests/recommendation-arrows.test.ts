import { describe, expect, test } from 'bun:test';
import {
  chessPuzzleArrows,
  isBoardSquare,
  PUZZLE_SOLUTION_ARROW_ID,
} from '@libs/chess-puzzle-shared/recommendation-arrows';

describe('chess puzzle arrows', () => {
  test('a suggestion names two squares of the board', () => {
    expect(isBoardSquare('e2')).toBe(true);
    expect(isBoardSquare('z9')).toBe(false);
  });

  test('the solution arrow comes first, then one coloured arrow per suggestion', () => {
    const arrows = chessPuzzleArrows({
      solution: { from: 'e2', to: 'e4' },
      suggestions: [
        { by: 'member-0', from: 'g1', to: 'f3', color: 'color:member-0' },
        { by: 'member-2', from: 'b1', to: 'c3', color: 'color:member-2' },
      ],
    });
    expect(arrows).toEqual([
      { from: 'e2', to: 'e4', id: PUZZLE_SOLUTION_ARROW_ID },
      { from: 'g1', to: 'f3', color: 'color:member-0', id: 'rec:member-0' },
      { from: 'b1', to: 'c3', color: 'color:member-2', id: 'rec:member-2' },
    ]);
  });

  test('no arrows without a shown solution or a suggestion', () => {
    expect(chessPuzzleArrows({ solution: null, suggestions: [] })).toEqual([]);
  });
});
