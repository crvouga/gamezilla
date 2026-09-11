import { describe, expect, test } from 'bun:test';
import { planPositionDiff } from '@pkgs/chess-board-core/animation/position-diff';
import { ChessGame } from '@pkgs/chess-board-core/game';
import {
  createPieceRowsTracker,
  type ChessPieceRow,
} from '@pkgs/chess-board-core/piece-rows';
import type { Move, Square } from '@pkgs/chess-board-core/types';

/** Tracker mutates row objects in place — snapshot before `next`. */
function snapshotRows(
  rows: readonly ChessPieceRow[]
): readonly ChessPieceRow[] {
  return rows.map((r) => ({ id: r.id, square: r.square, code: r.code }));
}

function trackPly(
  tracker: ReturnType<typeof createPieceRowsTracker>,
  game: ChessGame,
  move: { from: Square; to: Square; promotion?: Move['promotion'] }
) {
  const prevRows = snapshotRows(tracker.current());
  const prev = game.getSnapshot().position;
  const result = game.tryMove(move);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('move failed');
  const snap = game.getSnapshot();
  const nextRows = tracker.next(snap.position, snap.lastMove);
  return {
    prev,
    next: snap.position,
    lastMove: snap.lastMove,
    prevRows,
    nextRows,
  };
}

describe('planPositionDiff', () => {
  test('simple move yields one move motion', () => {
    const game = new ChessGame();
    const tracker = createPieceRowsTracker('t');
    tracker.next(game.getSnapshot().position, null);
    const diff = trackPly(tracker, game, { from: 'e2', to: 'e4' });
    const motions = planPositionDiff(diff);
    expect(motions).toHaveLength(1);
    expect(motions[0]).toMatchObject({
      from: 'e2',
      to: 'e4',
      kind: 'move',
      code: 'wp',
    });
  });

  test('castling yields king + rook move motions', () => {
    const game = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const tracker = createPieceRowsTracker('c');
    tracker.next(game.getSnapshot().position, null);
    const diff = trackPly(tracker, game, { from: 'e1', to: 'g1' });
    const motions = planPositionDiff(diff);
    expect(motions.every((m) => m.kind === 'move')).toBe(true);
    expect(motions).toHaveLength(2);
    expect(motions.find((m) => m.code === 'wk')).toMatchObject({
      from: 'e1',
      to: 'g1',
      kind: 'move',
    });
    expect(motions.find((m) => m.code === 'wr')).toMatchObject({
      from: 'h1',
      to: 'f1',
      kind: 'move',
    });
  });

  test('en passant marks captured pawn as capture', () => {
    const game = new ChessGame('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    const tracker = createPieceRowsTracker('e');
    tracker.next(game.getSnapshot().position, null);
    const diff = trackPly(tracker, game, { from: 'e5', to: 'd6' });
    const motions = planPositionDiff(diff);
    expect(motions.find((m) => m.kind === 'capture')).toMatchObject({
      from: 'd5',
      to: 'd5',
      code: 'bp',
      kind: 'capture',
    });
    expect(motions.find((m) => m.kind === 'move')).toMatchObject({
      from: 'e5',
      to: 'd6',
      kind: 'move',
    });
  });

  test('multi-ply rematch jump uses appear/disappear/move', () => {
    const game = new ChessGame();
    const tracker = createPieceRowsTracker('r');
    const start = game.getSnapshot().position;
    const prevRows = snapshotRows(tracker.next(start, null));
    game.tryMove({ from: 'e2', to: 'e4' });
    game.tryMove({ from: 'e7', to: 'e5' });
    game.tryMove({ from: 'g1', to: 'f3' });
    const next = game.getSnapshot().position;
    const nextRows = tracker.next(next, null);
    const motions = planPositionDiff({
      prev: start,
      next,
      lastMove: null,
      prevRows,
      nextRows,
    });
    expect(motions.some((m) => m.kind === 'move')).toBe(true);
    expect(motions.every((m) => m.kind !== 'capture')).toBe(true);
  });
});
