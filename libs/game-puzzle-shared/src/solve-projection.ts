/**
 * Pure projections from room attrs to what the puzzle board renders:
 * solve status, the next solution move and what the board
 * paints while a wrong move awaits its retry.
 */

import type { PuzzlePlayStatus } from './play-attr';
import { PUZZLE_PLAY_STATUS } from './play-attr';
import type { PuzzleGame } from './puzzle-setup';
import { playPuzzleAction } from './puzzle-setup';
import type { SolveStatus } from './solve-status';
import { lineActions } from './step';

/** Room status for a different puzzle (or idle) reads as `loading` for this screen. */
export function projectSolveStatus(args: {
  roomStatus: PuzzlePlayStatus;
  roomPuzzleId: string | null;
  puzzleId: string;
}): SolveStatus {
  if (
    args.roomStatus === PUZZLE_PLAY_STATUS.idle ||
    args.roomPuzzleId !== args.puzzleId
  ) {
    return 'loading';
  }
  return args.roomStatus;
}

/** The line's next solver move (`moves[solveIdx]`), or null unless solving. */
export function nextSolutionAction(args: {
  status: SolveStatus;
  moves: string;
  solveIdx: number;
}): string | null {
  if (args.status !== 'solving') return null;
  return lineActions(args.moves)[args.solveIdx] ?? null;
}

/**
 * Position the board paints. A wrong move is never applied to the room's
 * reached position, so while the attempt is `wrong` the board shows that
 * position with the wrong move played, as the game plays it: the piece
 * stays where it was dropped until a retry puts it back.
 */
export function projectBoardPosition(
  game: PuzzleGame,
  args: {
    status: SolveStatus;
    position: string | null;
    wrongAction: string | null;
  }
): string | null {
  if (
    args.status !== 'wrong' ||
    args.position === null ||
    args.wrongAction === null
  ) {
    return args.position;
  }
  const played = playPuzzleAction(game, args.position, args.wrongAction);
  return played?.played.position ?? args.position;
}
