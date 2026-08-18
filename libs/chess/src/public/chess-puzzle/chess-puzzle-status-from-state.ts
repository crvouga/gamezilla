import type { ChessPuzzleStatusKind } from './chess-puzzle-status-icons';
import type { SolveStatus } from './use-chess-puzzle-solver';

export function chessPuzzleStatusKindFromState(args: {
  status: SolveStatus;
  orientation: 'white' | 'black';
  showCorrectFlash: boolean;
}): ChessPuzzleStatusKind {
  const { status, orientation, showCorrectFlash } = args;
  if (status === 'loading') return 'loading';
  if (status === 'wrong') return 'wrong';
  if (status === 'solved') return 'solved';
  if (showCorrectFlash) return 'correct';
  return orientation === 'white' ? 'whiteToMove' : 'blackToMove';
}
