import type { SolveStatus } from './solve-status';

export type ChessPuzzleStatusKind =
  | 'loading'
  | 'empty'
  | 'offline'
  | 'limited'
  | 'whiteToMove'
  | 'blackToMove'
  | 'wrong'
  | 'solved';

export function chessPuzzleStatusKindFromState(args: {
  status: SolveStatus;
  orientation: 'white' | 'black';
}): ChessPuzzleStatusKind {
  const { status, orientation } = args;
  if (status === 'loading') return 'loading';
  if (status === 'wrong') return 'wrong';
  if (status === 'solved') return 'solved';
  return orientation === 'white' ? 'whiteToMove' : 'blackToMove';
}
