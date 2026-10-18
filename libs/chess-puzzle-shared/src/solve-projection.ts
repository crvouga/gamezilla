/**
 * Pure projections from room attrs to what the puzzle board renders:
 * solve status, move counting, and the next solution ply / hint arrow.
 */

import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import type { BoardArrow, Square } from '@pkgs/chess-board-core-shared/types';
import { applyUci } from '@pkgs/chess-rules-shared/moves';
import { tokenize } from './chess-puzzle-fsm';

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

export function countMoveTokens(moves: string): number {
  const trimmed = moves.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/** Next human solution UCI from `moves[solveIdx]`, or null unless solving. */
export function nextSolutionUci(args: {
  status: SolveStatus;
  moves: string;
  solveIdx: number;
}): string | null {
  if (args.status !== 'solving') return null;
  const token = tokenize(args.moves)[args.solveIdx];
  return token !== undefined && token.length >= 4 ? token : null;
}

/**
 * Position the board paints. A wrong move is never applied to the room's
 * reached position, so while the attempt is `wrong` the board shows that
 * position with the wrong move played: the piece stays where it was dropped
 * until a retry puts it back.
 */
export function projectBoardFen(args: {
  status: SolveStatus;
  fen: string | null;
  wrongUci: string | null;
}): string | null {
  if (args.status !== 'wrong' || args.fen === null || args.wrongUci === null) {
    return args.fen;
  }
  const played = applyUci(args.fen, args.wrongUci);
  return played.ok ? played.fen : args.fen;
}

const EMPTY_ARROWS: readonly BoardArrow[] = Object.freeze([]);

export const PUZZLE_SOLUTION_ARROW_ID = 'puzzle-solution';

/** Solution arrow shown only at the frontier once the hint escalated to `solution`. */
export function solutionArrows(args: {
  atFrontier: boolean;
  hintStage: HintStage;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
}): readonly BoardArrow[] {
  const { atFrontier, hintStage, expectedFromSquare, expectedToSquare } = args;
  if (
    !atFrontier ||
    hintStage !== 'solution' ||
    expectedFromSquare === null ||
    expectedToSquare === null
  ) {
    return EMPTY_ARROWS;
  }
  return [
    {
      from: expectedFromSquare as Square,
      to: expectedToSquare as Square,
      id: PUZZLE_SOLUTION_ARROW_ID,
    },
  ];
}
