import { buildPuzzleFenTrail } from './chess-puzzle-fen-trail';
import { tokenize } from './chess-puzzle-fsm';
import { CHESS_PUZZLE_PLAY_STATUS } from './chess-puzzle-play-attr';

/**
 * Rewind to the previous host-to-move position.
 * Odd `solveIdx` undoes human+opponent reply (−2); even undoes a terminal
 * human-only ply (−1). Returns `null` at the post-opening start (`solveIdx <= 1`).
 */
export function prevHumanSolveIdx(solveIdx: number): number | null {
  if (solveIdx <= 1) return null;
  if (solveIdx % 2 === 0) return solveIdx - 1;
  return solveIdx - 2;
}

/**
 * Advance one host turn toward `furthestSolveIdx` (human ply, plus opponent
 * reply when that reply was already reached before).
 */
export function nextForwardSolveIdx(args: {
  solveIdx: number;
  furthestSolveIdx: number;
  tokensLength: number;
}): number | null {
  const { solveIdx, furthestSolveIdx, tokensLength } = args;
  if (solveIdx >= furthestSolveIdx) return null;
  let next = solveIdx + 1;
  if (next < tokensLength && furthestSolveIdx > next) {
    next += 1;
  }
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

export function statusAtSolveIdx(
  solveIdx: number,
  tokensLength: number
): (typeof CHESS_PUZZLE_PLAY_STATUS)['solving' | 'solved'] {
  return solveIdx >= tokensLength
    ? CHESS_PUZZLE_PLAY_STATUS.solved
    : CHESS_PUZZLE_PLAY_STATUS.solving;
}

export function puzzleTokensLength(moves: string): number {
  return tokenize(moves).length;
}
