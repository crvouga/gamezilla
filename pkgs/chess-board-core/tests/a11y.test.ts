import { describe, expect, test } from 'bun:test';
import { resolveMoveEntry } from '@pkgs/chess-board-core/a11y/move-entry';
import {
  describePosition,
  speakMove,
} from '@pkgs/chess-board-core/a11y/speak-move';
import { ChessGame } from '@pkgs/chess-board-core/game';

describe('speakMove', () => {
  test('quiet, capture, check, castle', () => {
    expect(
      speakMove({
        move: { from: 'e2', to: 'e4' },
        piece: { color: 'w', type: 'p' },
        inCheck: false,
        isCheckmate: false,
      })
    ).toBe('Pawn to e4');
    expect(
      speakMove({
        move: { from: 'e4', to: 'd5', captured: 'p' },
        piece: { color: 'w', type: 'p' },
        inCheck: true,
        isCheckmate: false,
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

describe('resolveMoveEntry', () => {
  const cands = [
    { from: 'e2' as const, to: 'e4' as const, san: 'e4' },
    { from: 'g1' as const, to: 'f3' as const, san: 'Nf3' },
    { from: 'g1' as const, to: 'h3' as const, san: 'Nh3' },
  ];
  test('uci and san exact', () => {
    expect(resolveMoveEntry('e2e4', cands).kind).toBe('exact');
    expect(resolveMoveEntry('nf3', cands).kind).toBe('exact');
  });
  test('none and ambiguous', () => {
    expect(resolveMoveEntry('a2a3', cands).kind).toBe('none');
    expect(
      resolveMoveEntry('N', [
        { from: 'g1', to: 'f3', san: 'Nf3' },
        { from: 'b1', to: 'c3', san: 'Nc3' },
      ]).kind
    ).toBe('none');
  });
});
