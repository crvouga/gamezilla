import { expect, test } from 'bun:test';
import { chessRules } from '@libs/chess-rules-shared/chess-rules';

// regression: chess-play-accepts-noncanonical-actions
test('only the canonical spelling of a legal move is accepted', () => {
  const start = chessRules.initial();
  // A bogus promotion on a pawn move, found by the shared rules laws.
  expect(chessRules.play(start, 'b2b3a', '', [])).toBeNull();
  expect(chessRules.play(start, 'b2b3q', '', [])).toBeNull();
  expect(chessRules.play(start, 'b2b3', '', [])?.label).toBe('b3');
  // A promotion must name its piece.
  const promoting = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
  expect(chessRules.play(promoting, 'a7a8', '', [])).toBeNull();
  expect(chessRules.play(promoting, 'a7a8q', '', [])?.label).toBe('a8=Q');
});
