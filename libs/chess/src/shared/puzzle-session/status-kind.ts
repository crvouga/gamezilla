import type { SolveStatus } from './solve-status';

export type ChessPuzzleStatusKind =
  | 'loading'
  | 'whiteToMove'
  | 'blackToMove'
  | 'correct'
  | 'wrong'
  | 'solved';

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
