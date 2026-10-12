import { describe, expect, test } from 'bun:test';
import { ChessGame } from '@pkgs/chess-board-core-shared/game';
import {
  describePosition,
  speakMove,
} from '@pkgs/chess-board-core-shared/speak-move';

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

const QUIET = {
  inCheck: false,
  isCheckmate: false,
  isStalemate: false,
  isGameOver: false,
} as const;

describe('speakMove: a promotion is spoken as the pawn that moved', () => {
  // `piece` is what the board shows on the destination: the promoted piece.
  test('promotion to a queen', () => {
    expect(
      speakMove({
        ...QUIET,
        move: { from: 'e7', to: 'e8', promotion: 'q' },
        piece: { color: 'w', type: 'q' },
      })
    ).toBe('Pawn to e8, promotes to Queen');
  });

  test('capture-promotion, with check', () => {
    expect(
      speakMove({
        ...QUIET,
        move: { from: 'a7', to: 'b8', promotion: 'q', captured: 'n' },
        piece: { color: 'w', type: 'q' },
        inCheck: true,
      })
    ).toBe('Pawn takes b8, promotes to Queen, check');
  });

  test('underpromotion to each piece, with mate', () => {
    for (const [promotion, name] of [
      ['r', 'Rook'],
      ['b', 'Bishop'],
      ['n', 'Knight'],
    ] as const) {
      expect(
        speakMove({
          ...QUIET,
          move: { from: 'a2', to: 'a1', promotion },
          piece: { color: 'b', type: promotion },
        })
      ).toBe(`Pawn to a1, promotes to ${name}`);
    }
    expect(
      speakMove({
        ...QUIET,
        move: { from: 'f7', to: 'f8', promotion: 'n' },
        piece: { color: 'w', type: 'n' },
        inCheck: true,
        isCheckmate: true,
        isGameOver: true,
      })
    ).toBe('Pawn to f8, promotes to Knight, checkmate');
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
