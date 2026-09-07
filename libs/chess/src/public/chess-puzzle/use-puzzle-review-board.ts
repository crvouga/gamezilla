import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import type { Accessor } from 'solid-js';
import { createEffect, createMemo } from 'solid-js';

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
  readonly ready: Accessor<boolean>;
  readonly displayFen: Accessor<string>;
  readonly orientation: Accessor<ChessPuzzleOrientation>;
  readonly plies: Accessor<readonly PuzzleHistoryPly[]>;
  readonly solveIdx: Accessor<number>;
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
  const setup = createMemo(() => setupPuzzleStart(fen, moves));
  const tokensLength = createMemo(() => puzzleTokensLength(moves));

  createEffect(() => {
    if (tokensLength() <= 0) return;
    if (roomSolveIdx() !== 0) return;
    dispatch(SeekChessPuzzleReview({ solveIdx: tokensLength() }));
  });

  const solveIdx = createMemo(() =>
    roomSolveIdx() > 0 ? roomSolveIdx() : tokensLength()
  );

  const plies = createMemo(() =>
    buildPuzzleMoveHistory({ fen, moves, throughIdx: tokensLength() })
  );

  const displayFen = createMemo(() => {
    const atIdx = fenAtSolveIdx({ fen, moves, solveIdx: solveIdx() });
    if (atIdx !== null) return atIdx;
    const s = setup();
    return s.kind === 'ready' ? s.displayFen : '';
  });

  const orientation = createMemo<ChessPuzzleOrientation>(() => {
    const s = setup();
    return s.kind === 'ready' ? s.orientation : 'white';
  });

  const ready = createMemo(
    () => setup().kind === 'ready' && displayFen().length > 0
  );

  const onSeek = (targetSolveIdx: number): void => {
    if (targetSolveIdx < 1 || targetSolveIdx > tokensLength()) return;
    if (targetSolveIdx === roomSolveIdx()) return;
    dispatch(SeekChessPuzzleReview({ solveIdx: targetSolveIdx }));
  };

  return { ready, displayFen, orientation, plies, solveIdx, onSeek };
}
