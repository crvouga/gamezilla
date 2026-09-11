/**
 * Plan piece motions between two positions using stable {@link ChessPieceRow}
 * ids (castling = two moves, en passant = move + capture disappear, rematch
 * jumps = appear / disappear / slide).
 */

import { captureVictimSquare } from '../capture-ghost';
import type { ChessPieceRow } from '../piece-rows';
import type { Move, PieceCode, Position, Square } from '../types';

export type PieceMotion = {
  id: string;
  from: Square;
  to: Square;
  code: PieceCode;
  kind: 'move' | 'appear' | 'disappear' | 'capture';
};

function pushDisappearOrCapture(
  motions: PieceMotion[],
  prev: ChessPieceRow,
  lastMove: Move | null
): void {
  const victim =
    lastMove !== null && lastMove.captured !== undefined
      ? captureVictimSquare(lastMove)
      : null;
  const kind =
    victim !== null && prev.square === victim ? 'capture' : 'disappear';
  motions.push({
    id: prev.id,
    from: prev.square,
    to: prev.square,
    code: prev.code,
    kind,
  });
}

function pushMoveOrAppear(
  motions: PieceMotion[],
  prev: ChessPieceRow | undefined,
  next: ChessPieceRow
): void {
  if (prev === undefined) {
    motions.push({
      id: next.id,
      from: next.square,
      to: next.square,
      code: next.code,
      kind: 'appear',
    });
    return;
  }
  if (prev.square === next.square && prev.code === next.code) return;
  motions.push({
    id: next.id,
    from: prev.square,
    to: next.square,
    code: next.code,
    kind: 'move',
  });
}

/**
 * Diff `prevRows` → `nextRows`. `prev` / `next` positions are accepted for
 * call-site clarity (planner keys off row ids + `lastMove`).
 */
export function planPositionDiff(args: {
  prev: Position;
  next: Position;
  lastMove: Move | null;
  prevRows: readonly ChessPieceRow[];
  nextRows: readonly ChessPieceRow[];
}): readonly PieceMotion[] {
  void args.prev;
  void args.next;
  const prevById = new Map(args.prevRows.map((r) => [r.id, r]));
  const nextById = new Map(args.nextRows.map((r) => [r.id, r]));
  const motions: PieceMotion[] = [];

  for (const prev of args.prevRows) {
    if (!nextById.has(prev.id)) {
      pushDisappearOrCapture(motions, prev, args.lastMove);
    }
  }
  for (const next of args.nextRows) {
    pushMoveOrAppear(motions, prevById.get(next.id), next);
  }
  return motions;
}
