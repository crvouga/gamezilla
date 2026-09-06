/**
 * Capture "ghost": the victim piece stays drawn under the sliding attacker
 * for the duration of the move animation so it does not vanish early.
 */

import { indexFromSquare } from './geometry';
import { inferLastMoveFromPositionDiff } from './infer-move';
import { pieceCode } from './piece-svgs';
import { positionsEqual } from './position';
import type { Move, PieceCode, PieceColor, Position, Square } from './types';

export type CaptureGhost = {
  readonly square: Square;
  readonly code: PieceCode;
};

/** Square the victim stood on (en passant captures behind the destination). */
export function captureVictimSquare(
  move: Pick<Move, 'from' | 'to' | 'enPassant'>
): Square {
  return move.enPassant ? (`${move.to[0]}${move.from[1]}` as Square) : move.to;
}

/** The capturing ply, preferring the explicit last move over a position diff. */
export function resolveCaptureMove(
  lastMove: Move | null,
  prev: Position,
  position: Position
): Move | null {
  if (lastMove?.captured !== undefined) return lastMove;
  const inferred = inferLastMoveFromPositionDiff(prev, position);
  if (inferred?.captured) return inferred;
  return null;
}

/** Ghost payload for a capturing move, or null when nothing was captured. */
export function buildCaptureGhost(
  position: Position,
  captureMove: Move
): CaptureGhost | null {
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
 * Ghost to show for a position transition, or null when the transition
 * was not a capture (or animations are off — no slide to cover).
 */
export function captureGhostForTransition(args: {
  prev: Position | null;
  position: Position;
  lastMove: Move | null;
  animations: boolean;
}): CaptureGhost | null {
  const { prev, position, lastMove, animations } = args;
  if (!animations || prev === null) return null;
  if (positionsEqual(prev, position)) return null;
  const move = resolveCaptureMove(lastMove, prev, position);
  if (move === null) return null;
  return buildCaptureGhost(position, move);
}
