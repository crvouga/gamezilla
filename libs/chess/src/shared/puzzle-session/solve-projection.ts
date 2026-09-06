/**
 * Pure projections from room attrs to what the puzzle board renders:
 * solve status, move counting, and the next solution ply / hint arrow.
 */

import type { BoardArrow, Square } from '@pkgs/chess-board-core/types';

import { tokenize } from '../chess/chess-puzzle-fsm';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../chess/chess-puzzle-play';
import type { HintStage } from './hint-stage';
import type { SolveStatus } from './solve-status';

/** Room status for a different puzzle (or idle) reads as `loading` for this screen. */
export function projectSolveStatus(args: {
  roomStatus: ChessPuzzlePlayStatus;
  roomPuzzleId: string | null;
  puzzleId: string;
}): SolveStatus {
  if (
    args.roomStatus === CHESS_PUZZLE_PLAY_STATUS.idle ||
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
