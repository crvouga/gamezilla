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

/**
 * Holds the captured piece under the sliding attacker for MOVE_MS so the
 * victim does not vanish before the mover arrives. Disabled when animations
 * are off (instant snap — no slide to cover).
 */
export function useChessBoardCaptureGhost(
  position: Position,
  lastMove: Move | null,
  animations: boolean
): { captureGhost: { square: Square; code: PieceCode } | null } {
  const prevPositionRef = useRef<Position | null>(null);
  const [captureGhost, setCaptureGhost] = useState<{
    square: Square;
    code: PieceCode;
  } | null>(null);

  /**
   * Timer is owned by a ref (not effect cleanup) so unrelated re-renders that
   * re-run this effect with the same `position` (e.g. controlled board where
   * `useExternalFenSync` flips `lastMove` to `null` after the parent FEN
   * arrives) don't cancel the in-flight ghost timeout. Without this, the last
   * move of a controlled flow (puzzle solver) would clear the timer in the
   * cleanup step and the early-return branch below would leave `captureGhost`
   * stuck forever — visually stacking the captured piece on top of the mover.
   */
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearGhostTimer = (): void => {
    if (ghostTimerRef.current !== null) {
      clearTimeout(ghostTimerRef.current);
      ghostTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearGhostTimer();
    };
  }, []);

  useEffect(() => {
    if (!animations) {
      clearGhostTimer();
      setCaptureGhost(null);
      prevPositionRef.current = position;
      return;
    }

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
      clearGhostTimer();
      setCaptureGhost(null);
      return;
    }

    clearGhostTimer();
    setCaptureGhost(payload);
    ghostTimerRef.current = setTimeout(() => {
      ghostTimerRef.current = null;
      setCaptureGhost(null);
    }, CHESS_PIECE_MOVE_MS);
  }, [position, lastMove, animations]);

  return { captureGhost };
}
