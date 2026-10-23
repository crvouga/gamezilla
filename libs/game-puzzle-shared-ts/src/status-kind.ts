import type { SolveStatus } from './solve-status';

/**
 * Everything the puzzle header can say. The first block is the shell (no
 * puzzle placed yet); the second is the live attempt.
 */
export type PuzzleStatusKind =
  | 'loading'
  | 'empty'
  | 'offline'
  | 'limited'
  | 'waiting'
  | 'started'
  | 'failed'
  | 'skipped'
  | 'solved';

/** Live status → header kind. Side to move is a separate caption. */
export function puzzleStatusKindFromState(args: {
  orientation?: 'white' | 'black';
  status: SolveStatus;
}): PuzzleStatusKind {
  switch (args.status) {
    case 'solving':
      return 'started';
    case 'wrong':
    case 'revealed':
      return 'failed';
    case 'skipped':
      return 'skipped';
    case 'solved':
      return 'solved';
    case 'invalid':
      return 'failed';
    default:
      return 'loading';
  }
}
