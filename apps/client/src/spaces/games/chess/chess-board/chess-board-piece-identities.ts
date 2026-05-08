import { useEffect, useRef, useState } from 'react';
import type { Move, PieceCode, Position, Square } from './chess-board-types';
import { squareFromIndex } from './chess-board-geometry';
import { pieceCode } from './chess-pieces-svg';

export type ChessPieceRow = {
  id: string;
  square: Square;
  code: PieceCode;
  /** True once for newly spawned pieces (promotion / fresh id) */
  fadeIn?: boolean;
};

let nextPieceId = 1;
function allocPieceId(): string {
  return `cp-${nextPieceId++}`;
}

function positionKey(pos: Position): string {
  let s = '';
  for (let i = 0; i < 64; i++) {
    const p = pos[i];
    s += p ? `${p.color}${p.type}` : '-';
  }
  return s;
}

function positionsEqual(a: Position, b: Position): boolean {
  return positionKey(a) === positionKey(b);
}

function scanRows(pos: Position): ChessPieceRow[] {
  const rows: ChessPieceRow[] = [];
  for (let i = 0; i < 64; i++) {
    const p = pos[i];
    if (!p) continue;
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    rows.push({
      id: allocPieceId(),
      square: squareFromIndex(i),
      code,
    });
  }
  return rows;
}

type ResolvePieceArgs = {
  sq: Square;
  code: PieceCode;
  active: readonly ChessPieceRow[];
  lastMove: Move;
  mover: ChessPieceRow | undefined;
};

function resolvePieceId(args: ResolvePieceArgs): {
  id: string;
  fadeIn: boolean;
} {
  const { sq, code, active, lastMove, mover } = args;
  if (mover && sq === lastMove.to) {
    return { id: mover.id, fadeIn: false };
  }
  const castle = lastMove.castle;
  if (castle && sq === castle.rookTo) {
    const rook = active.find((r) => r.square === castle.rookFrom);
    return rook
      ? { id: rook.id, fadeIn: false }
      : { id: allocPieceId(), fadeIn: true };
  }
  const same = active.find((r) => r.square === sq && r.code === code);
  return same
    ? { id: same.id, fadeIn: false }
    : { id: allocPieceId(), fadeIn: true };
}

function buildNextRows(
  position: Position,
  active: ChessPieceRow[],
  lastMove: Move
): ChessPieceRow[] {
  const mover = active.find((r) => r.square === lastMove.from);

  const next: ChessPieceRow[] = [];
  for (let i = 0; i < 64; i++) {
    const p = position[i];
    if (!p) continue;
    const sq = squareFromIndex(i);
    const code = pieceCode(p.color, p.type);
    if (!code) continue;
    const { id, fadeIn } = resolvePieceId({
      sq,
      code,
      active,
      lastMove,
      mover,
    });
    next.push({ id, square: sq, code, ...(fadeIn ? { fadeIn: true } : {}) });
  }
  return next;
}

export function useChessPieceRows(
  position: Position,
  lastMove: Move | null
): { active: ChessPieceRow[] } {
  const [active, setActive] = useState<ChessPieceRow[]>(() =>
    scanRows(position)
  );
  const prevPositionRef = useRef<Position | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const prev = prevPositionRef.current;
    if (prev === null) {
      prevPositionRef.current = position;
      return;
    }

    if (positionsEqual(prev, position)) {
      prevPositionRef.current = position;
      return;
    }

    if (!lastMove) {
      setActive(scanRows(position));
      prevPositionRef.current = position;
      return;
    }

    const next = buildNextRows(position, activeRef.current, lastMove);
    setActive(next);
    prevPositionRef.current = position;
  }, [position, lastMove]);

  return { active };
}
