import type { SolveStatus } from './solve-status';

/**
 * Two-step hint reveal (room-synced):
 *
 *   - `'none'`: no hint requested.
 *   - `'highlight'`: room has expected from/to squares.
 *   - `'solution'`: room `solutionRevealed` is set (full arrow), or the whole
 *     line was shown ("Show solution", room status `revealed`).
 */
export type HintStage = 'none' | 'highlight' | 'solution';

export function hintStageFromRoom(args: {
  status: SolveStatus;
  expectedFromSquare: string | null;
  solutionRevealed: boolean;
}): HintStage {
  if (args.status === 'revealed') return 'solution';
  if (args.expectedFromSquare === null) return 'none';
  return args.solutionRevealed ? 'solution' : 'highlight';
}
