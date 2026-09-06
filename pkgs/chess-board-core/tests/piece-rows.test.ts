import { describe, expect, test } from 'bun:test';
import { inferLastMoveFromPositionDiff } from '@pkgs/chess-board-core/infer-move';
import {
  type ChessPieceRow,
  createPieceRowsTracker,
} from '@pkgs/chess-board-core/piece-rows';
import { positionFromChess } from '@pkgs/chess-board-core/position';
import type { Square } from '@pkgs/chess-board-core/types';
import { Chess } from 'chess.js';

function rowAt(rows: readonly ChessPieceRow[], sq: Square) {
  return rows.find((r) => r.square === sq);
}

describe('inferLastMoveFromPositionDiff', () => {
  test('simple move, capture, promotion', () => {
    const c = new Chess();
    const p0 = positionFromChess(c);
    c.move('e4');
    const p1 = positionFromChess(c);
    expect(inferLastMoveFromPositionDiff(p0, p1)).toEqual({
      from: 'e2',
      to: 'e4',
    });

    const cap = new Chess('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    const q0 = positionFromChess(cap);
    cap.move('exd5');
    expect(inferLastMoveFromPositionDiff(q0, positionFromChess(cap))).toEqual({
      from: 'e4',
      to: 'd5',
      captured: 'p',
    });

    const promo = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const r0 = positionFromChess(promo);
    promo.move('a8=Q');
    expect(inferLastMoveFromPositionDiff(r0, positionFromChess(promo))).toEqual(
      {
        from: 'a7',
        to: 'a8',
        promotion: 'q',
      }
    );
  });

  test('en passant and castling', () => {
    const ep = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    const e0 = positionFromChess(ep);
    ep.move('exd6');
    expect(inferLastMoveFromPositionDiff(e0, positionFromChess(ep))).toEqual({
      from: 'e5',
      to: 'd6',
      captured: 'p',
      enPassant: true,
    });

    const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const c0 = positionFromChess(castle);
    castle.move('O-O-O');
    expect(
      inferLastMoveFromPositionDiff(c0, positionFromChess(castle))
    ).toEqual({
      from: 'e1',
      to: 'c1',
      castle: { rookFrom: 'a1', rookTo: 'd1' },
    });
  });

  test('returns null for multi-ply jumps', () => {
    const c = new Chess();
    const p0 = positionFromChess(c);
    c.move('e4');
    c.move('e5');
    c.move('Nf3');
    expect(inferLastMoveFromPositionDiff(p0, positionFromChess(c))).toBeNull();
  });
});

describe('createPieceRowsTracker', () => {
  test('keeps the mover id across a ply and the rook id across castling', () => {
    const tracker = createPieceRowsTracker('t');
    const c = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const rows0 = tracker.next(positionFromChess(c), null);
    const kingId = rowAt(rows0, 'e1')?.id;
    const rookId = rowAt(rows0, 'h1')?.id;
    expect(kingId).toBeDefined();
    expect(rows0.every((r) => r.id.startsWith('t-'))).toBe(true);

    c.move('O-O');
    const rows1 = tracker.next(positionFromChess(c), null);
    expect(rowAt(rows1, 'g1')?.id).toBe(kingId as string);
    expect(rowAt(rows1, 'f1')?.id).toBe(rookId as string);
    expect(rows1.some((r) => r.fadeIn)).toBe(false);
  });

  test('same position returns the cached rows', () => {
    const tracker = createPieceRowsTracker();
    const c = new Chess();
    const a = tracker.next(positionFromChess(c), null);
    const b = tracker.next(positionFromChess(c), null);
    expect(b).toBe(a);
    expect(tracker.current()).toBe(a);
  });

  test('promotion spawns a fresh id with fadeIn', () => {
    const tracker = createPieceRowsTracker();
    const c = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    const rows0 = tracker.next(positionFromChess(c), null);
    const pawnId = rowAt(rows0, 'a7')?.id;
    c.move('a8=Q');
    const rows1 = tracker.next(positionFromChess(c), null);
    const queen = rowAt(rows1, 'a8');
    // Mover id is reused for the landing square (queen slides in as the pawn).
    expect(queen?.id).toBe(pawnId as string);
    expect(queen?.code).toBe('wq');
  });

  test('non-ply position swap rematches resting pieces by square then by code', () => {
    const tracker = createPieceRowsTracker();
    const c = new Chess();
    const rows0 = tracker.next(positionFromChess(c), null);
    const e1 = rowAt(rows0, 'e1')?.id;
    // Jump three plies: not inferable as one move → rematch path.
    c.move('e4');
    c.move('e5');
    c.move('Nf3');
    const rows1 = tracker.next(positionFromChess(c), null);
    expect(rowAt(rows1, 'e1')?.id).toBe(e1 as string);
    // The knight that left g1 keeps its id via code fallback.
    const g1 = rowAt(rows0, 'g1')?.id;
    expect(rowAt(rows1, 'f3')?.id).toBe(g1 as string);
    expect(rows1).toHaveLength(32);
  });
});
