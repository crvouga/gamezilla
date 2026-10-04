import { buildPuzzleFenTrail } from './chess-puzzle-fen-trail';
import { tokenize } from './chess-puzzle-fsm';

/**
 * Rewind one ply along the solution line (player or opponent).
 * Returns `null` at the post-opening start (`solveIdx <= 1`).
 */
export function prevSolveIdx(solveIdx: number): number | null {
  if (solveIdx <= 1) return null;
  return solveIdx - 1;
}

/**
 * Advance one ply toward `furthestSolveIdx` (never past unattempted moves).
 */
export function nextForwardSolveIdx(args: {
  solveIdx: number;
  furthestSolveIdx: number;
  tokensLength: number;
}): number | null {
  const { solveIdx, furthestSolveIdx, tokensLength } = args;
  if (solveIdx >= furthestSolveIdx) return null;
  const next = solveIdx + 1;
  if (next > tokensLength) return null;
  return Math.min(next, furthestSolveIdx);
}

export function fenAtSolveIdx(args: {
  fen: string;
  moves: string;
  solveIdx: number;
}): string | null {
  const trail = buildPuzzleFenTrail({
    fen: args.fen,
    moves: args.moves,
    throughIdx: args.solveIdx,
  });
  if (trail.length === 0) return null;
  return trail[trail.length - 1] ?? null;
}

export function puzzleTokensLength(moves: string): number {
  return tokenize(moves).length;
}

/**
 * Absolute seek target for move-list taps. Allowed range is
 * `[1, furthestSolveIdx]` (post-opening through furthest attempted).
 * Returns `null` when the target is out of range or already current.
 */
export function resolveSeekSolveIdx(args: {
  solveIdx: number;
  furthestSolveIdx: number;
  targetSolveIdx: number;
}): number | null {
  const { solveIdx, furthestSolveIdx, targetSolveIdx } = args;
  if (targetSolveIdx < 1 || targetSolveIdx > furthestSolveIdx) return null;
  if (targetSolveIdx === solveIdx) return null;
  return targetSolveIdx;
}
