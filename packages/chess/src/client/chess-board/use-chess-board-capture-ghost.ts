import { useEffect, useRef, useState } from 'react';
import { indexFromSquare } from './chess-board-geometry';
import { CHESS_PIECE_MOVE_MS } from './chess-board-piece';
import {
  inferLastMoveFromPositionDiff,
  positionsEqual,
} from './chess-board-piece-identities';
import type {
  Move,
  PieceCode,
  PieceColor,
  Position,
  Square,
} from './chess-board-types';
import { pieceCode } from './chess-pieces-svg';

function captureVictimSquare(
  move: Pick<Move, 'from' | 'to' | 'enPassant'>
): Square {
  return move.enPassant ? (`${move.to[0]}${move.from[1]}` as Square) : move.to;
}

function resolveCaptureMove(
  lastMove: Move | null,
  prev: Position,
  position: Position
): Move | null {
  const inferred = inferLastMoveFromPositionDiff(prev, position);
  if (lastMove?.captured !== undefined) return lastMove;
  if (inferred?.captured) return inferred;
  return null;
}

function buildCaptureGhostPayload(
  position: Position,
  captureMove: Move
): { square: Square; code: PieceCode } | null {
  if (!captureMove.captured) return null;
  const victimSq = captureVictimSquare(captureMove);
  const attacker = position[indexFromSquare(captureMove.to)];
  if (!attacker) return null;
  const victimColor: PieceColor = attacker.color === 'w' ? 'b' : 'w';
  const code = pieceCode(victimColor, captureMove.captured);
  if (!code) return null;
  return { square: victimSq, code };
}

export function useChessBoardCaptureGhost(
  position: Position,
  lastMove: Move | null
): { captureGhost: { square: Square; code: PieceCode } | null } {
  const prevPositionRef = useRef<Position | null>(null);
  const [captureGhost, setCaptureGhost] = useState<{
    square: Square;
    code: PieceCode;
  } | null>(null);

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

    const captureMove = resolveCaptureMove(lastMove, prev, position);
    prevPositionRef.current = position;

    const payload =
      captureMove !== null
        ? buildCaptureGhostPayload(position, captureMove)
        : null;
    if (!payload) {
      setCaptureGhost(null);
      return;
    }

    setCaptureGhost(payload);
    const t = setTimeout(() => setCaptureGhost(null), CHESS_PIECE_MOVE_MS);
    return () => clearTimeout(t);
  }, [position, lastMove]);

  return { captureGhost };
}
