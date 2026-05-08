import { useCallback, useEffect, useRef, useState } from 'react';
import type { Move, PieceCode, Position, Square } from './chess-board-types';
import { indexFromSquare, squareFromIndex } from './chess-board-geometry';
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

function enPassantVictimSquare(
  from: Square,
  to: Square,
  captured?: Move['captured']
): Square | null {
  if (captured !== 'p') return null;
  const ff = from.charCodeAt(0);
  const tf = to.charCodeAt(0);
  if (ff === tf) return null;
  if (Math.abs(tf - ff) !== 1) return null;
  if (from[1] !== to[1]) return null;
  const file = to[0]!;
  const rank = from[1]!;
  return `${file}${rank}` as Square;
}

type CaptureExitArgs = {
  exiting: ChessPieceRow[];
  prev: Position;
  active: readonly ChessPieceRow[];
  lastMove: Move;
  mover: ChessPieceRow | undefined;
};

function pushCaptureExits(args: CaptureExitArgs): void {
  const { exiting, prev, active, lastMove, mover } = args;
  if (!lastMove.captured) return;
  const victimSq = prev[indexFromSquare(lastMove.to)]
    ? lastMove.to
    : enPassantVictimSquare(lastMove.from, lastMove.to, lastMove.captured);
  if (!victimSq) return;
  const victim = active.find(
    (r) => r.square === victimSq && r.id !== mover?.id
  );
  if (victim) exiting.push({ ...victim });
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
  prev: Position,
  position: Position,
  active: ChessPieceRow[],
  lastMove: Move
): { next: ChessPieceRow[]; exiting: ChessPieceRow[] } {
  const exiting: ChessPieceRow[] = [];
  const mover = active.find((r) => r.square === lastMove.from);
  pushCaptureExits({ exiting, prev, active, lastMove, mover });

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
  return { next, exiting };
}

export function useChessPieceRows(
  position: Position,
  lastMove: Move | null
): {
  active: ChessPieceRow[];
  exiting: ChessPieceRow[];
  consumeExiting: (id: string) => void;
} {
  const [active, setActive] = useState<ChessPieceRow[]>(() =>
    scanRows(position)
  );
  const [exiting, setExiting] = useState<ChessPieceRow[]>([]);
  const prevPositionRef = useRef<Position | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const consumeExiting = useCallback((id: string) => {
    setExiting((xs) => xs.filter((r) => r.id !== id));
  }, []);

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
      setExiting([]);
      prevPositionRef.current = position;
      return;
    }

    const { next, exiting: newExiting } = buildNextRows(
      prev,
      position,
      activeRef.current,
      lastMove
    );
    setActive(next);
    if (newExiting.length > 0) {
      setExiting((e) => [...e, ...newExiting]);
    }
    prevPositionRef.current = position;
  }, [position, lastMove]);

  return { active, exiting, consumeExiting };
}
