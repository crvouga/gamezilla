/**
 * Chess's replay of a puzzle line: the position after `solveIdx` actions.
 */
import { buildPuzzleFenTrail } from './chess-puzzle-fen-trail';

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
