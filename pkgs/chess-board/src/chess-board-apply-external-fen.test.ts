import { describe, expect, test } from 'bun:test';
import { Chess } from 'chess.js';

import { applyExternalFenToChess } from './chess-board-apply-external-fen';

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('applyExternalFenToChess', () => {
  test('same fen is a no-op', () => {
    const chess = new Chess(START);
    expect(applyExternalFenToChess(chess, START)).toBeNull();
    expect(chess.fen()).toBe(START);
  });

  test('single ply returns inferred move', () => {
    const chess = new Chess(START);
    const after = new Chess(START);
    after.move({ from: 'e2', to: 'e4' });
    const result = applyExternalFenToChess(chess, after.fen());
    expect(result).not.toBeNull();
    expect(result?.moved).toEqual({ from: 'e2', to: 'e4' });
    expect(chess.fen()).toBe(after.fen());
  });
});
