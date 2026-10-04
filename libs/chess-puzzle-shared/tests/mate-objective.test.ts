import { expect, test } from 'bun:test';
import { judgePuzzleMove } from '@libs/chess-puzzle-shared/chess-puzzle-move-judge';

// regression: puzzle-stored-mate-continues
test('checkmate ends play even when contradictory data expects another reply', () => {
  const result = judgePuzzleMove({
    fen: '7k/RR6/8/8/p7/8/8/6K1 w - - 0 2',
    tokens: ['a5a4', 'b7b8', 'a4a3', 'b8c8'],
    idx: 1,
    uci: 'b7b8',
  });
  expect(result).toMatchObject({ kind: 'correct', ends: true });
  expect(result.kind === 'correct' && result.line).toEqual(['a5a4', 'b7b8']);
});
