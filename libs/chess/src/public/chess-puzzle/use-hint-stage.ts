/**
 * Two-step hint reveal (room-synced):
 *
 *   - `'none'`: no hint requested.
 *   - `'highlight'`: room has expected from/to squares.
 *   - `'solution'`: room `solutionRevealed` is set (full arrow).
 */
export type HintStage = 'none' | 'highlight' | 'solution';

export function hintStageFromRoom(args: {
  expectedFromSquare: string | null;
  solutionRevealed: boolean;
}): HintStage {
  if (args.expectedFromSquare === null) return 'none';
  return args.solutionRevealed ? 'solution' : 'highlight';
}
