import { expect, spyOn, test } from 'bun:test';
import { puzzleCommentary } from '@libs/chess-puzzle-shared-ts/puzzle-commentary';
import { Chess } from 'chess.js';

// regression: puzzle-drop-diagnosis-work
test('a quiet wrong drop does not replay every legal move to look for mate', () => {
  const moves = spyOn(Chess.prototype, 'move');
  try {
    const result = puzzleCommentary({
      puzzleId: 'quiet-opening',
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      status: 'wrong',
      solveIdx: 1,
      layoutKey: 0,
      wrongUci: 'a2a3',
      hint: 'none',
      opponentReplying: false,
      viewingHistory: false,
    });
    expect(result?.kind).toBe('wrong');
    // One attempted move and the opponent's four knight continuations.
    expect(moves.mock.calls.length).toBeLessThanOrEqual(5);
  } finally {
    moves.mockRestore();
  }
});

test('check feedback avoids all candidate move applications', () => {
  const moves = spyOn(Chess.prototype, 'move');
  try {
    const result = puzzleCommentary({
      puzzleId: 'escape-check',
      fen: '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1',
      status: 'wrong',
      solveIdx: 1,
      layoutKey: 0,
      wrongUci: 'e1d1',
      hint: 'none',
      opponentReplying: false,
      viewingHistory: false,
    });
    expect(result?.kind).toBe('check');
    expect(moves.mock.calls).toHaveLength(0);
  } finally {
    moves.mockRestore();
  }
});
