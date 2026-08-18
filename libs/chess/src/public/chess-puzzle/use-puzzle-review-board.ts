import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { useCallback, useEffect, useMemo } from 'react';

import {
  ChessMainMenuScreenAttr,
  SeekChessPuzzleReview,
} from '../chess-main-menu';
import type { ChessPuzzleOrientation } from '../chess-puzzle-fsm';
import { setupPuzzleStart } from '../chess-puzzle-fsm';
import type { PuzzleHistoryPly } from '../chess-puzzle-move-history';
import { buildPuzzleMoveHistory } from '../chess-puzzle-move-history';
import { fenAtSolveIdx, puzzleTokensLength } from '../chess-puzzle-step';

export type PuzzleReviewBoardModel = {
  readonly ready: boolean;
  readonly displayFen: string;
  readonly orientation: ChessPuzzleOrientation;
  readonly plies: readonly PuzzleHistoryPly[];
  readonly solveIdx: number;
  readonly onSeek: (solveIdx: number) => void;
};

export function usePuzzleReviewBoard(
  fen: string,
  moves: string
): PuzzleReviewBoardModel {
  const dispatch = useSpaceRoomDispatch();
  const roomSolveIdx = useSpaceRoomSelector(
    ChessMainMenuScreenAttr.selectedReviewSolveIdx.from
  );
  const setup = useMemo(() => setupPuzzleStart(fen, moves), [fen, moves]);
  const tokensLength = useMemo(() => puzzleTokensLength(moves), [moves]);

  useEffect(() => {
    if (tokensLength <= 0) return;
    if (roomSolveIdx !== 0) return;
    dispatch(SeekChessPuzzleReview({ solveIdx: tokensLength }));
  }, [dispatch, roomSolveIdx, tokensLength]);

  const solveIdx = roomSolveIdx > 0 ? roomSolveIdx : tokensLength;

  const plies = useMemo(
    () =>
      buildPuzzleMoveHistory({
        fen,
        moves,
        throughIdx: tokensLength,
      }),
    [fen, moves, tokensLength]
  );

  const displayFen = useMemo(() => {
    const atIdx = fenAtSolveIdx({ fen, moves, solveIdx });
    if (atIdx !== null) return atIdx;
    return setup.kind === 'ready' ? setup.displayFen : '';
  }, [fen, moves, setup, solveIdx]);

  const orientation: ChessPuzzleOrientation =
    setup.kind === 'ready' ? setup.orientation : 'white';

  const onSeek = useCallback(
    (targetSolveIdx: number) => {
      if (targetSolveIdx < 1 || targetSolveIdx > tokensLength) return;
      if (targetSolveIdx === roomSolveIdx) return;
      dispatch(SeekChessPuzzleReview({ solveIdx: targetSolveIdx }));
    },
    [dispatch, roomSolveIdx, tokensLength]
  );

  return {
    ready: setup.kind === 'ready' && displayFen.length > 0,
    displayFen,
    orientation,
    plies,
    solveIdx,
    onSeek,
  };
}
