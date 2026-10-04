import { describe, expect, test } from 'bun:test';
import { describePosition, speakMove } from '@pkgs/chess-board-core-shared/speak-move';
import { ChessGame } from '@pkgs/chess-board-core-shared/game';

describe('speakMove', () => {
  test('quiet, capture, check, castle', () => {
    expect(
      speakMove({
        move: { from: 'e2', to: 'e4' },
        piece: { color: 'w', type: 'p' },
        inCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isGameOver: false,
      })
    ).toBe('Pawn to e4');
    expect(
      speakMove({
        move: { from: 'e4', to: 'd5', captured: 'p' },
        piece: { color: 'w', type: 'p' },
        inCheck: true,
        isCheckmate: false,
        isStalemate: false,
        isGameOver: false,
      })
    ).toBe('Pawn takes d5, check');
    expect(
      speakMove({
        move: {
          from: 'e1',
          to: 'g1',
          castle: { rookFrom: 'h1', rookTo: 'f1' },
        },
        piece: { color: 'w', type: 'k' },
        inCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isGameOver: false,
      })
    ).toBe('King castles kingside');
  });
});

describe('describePosition', () => {
  test('mentions side to move and a piece', () => {
    const game = new ChessGame();
    const text = describePosition(game.getSnapshot().position, 'w');
    expect(text.startsWith('White to move.')).toBe(true);
    expect(text).toContain('White King on e1');
  });
});
