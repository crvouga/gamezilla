import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import {
  nextForwardSolveIdx,
  prevHumanSolveIdx,
  puzzleTokensLength,
} from '../../shared/chess-puzzle-step';

export type PuzzleNavModel = {
  atFrontier: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
};

/** Pure nav affordances from room attrs (authoritative step back/forward). */
export function puzzleNavFromState(args: {
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  furthestSolveIdx: number;
  moves: string;
}): PuzzleNavModel {
  const { status, solveIdx, furthestSolveIdx, moves } = args;
  const scrubbing =
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.solved;
  if (!scrubbing) {
    return { atFrontier: true, canGoBack: false, canGoForward: false };
  }
  const tokensLength = puzzleTokensLength(moves);
  const canGoBack = prevHumanSolveIdx(solveIdx) !== null;
  const canGoForward =
    nextForwardSolveIdx({
      solveIdx,
      furthestSolveIdx,
      tokensLength,
    }) !== null;
  return {
    atFrontier: solveIdx >= furthestSolveIdx,
    canGoBack,
    canGoForward,
  };
}
