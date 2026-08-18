import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';
import { type ReactNode, useCallback, useMemo } from 'react';
import { buildPuzzleMoveHistory } from '../../shared/chess-puzzle-move-history';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  SeekChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';

/**
 * Room-backed chess.com-style move history for the active puzzle session.
 */
export function ChessPuzzleMoveHistoryBar(): ReactNode {
  const dispatch = useSpaceRoomDispatch();
  const fen = useSpaceRoomSelector(ChessPuzzlePlayAttr.fen.from);
  const moves = useSpaceRoomSelector(ChessPuzzlePlayAttr.moves.from);
  const solveIdx = useSpaceRoomSelector(ChessPuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.furthestSolveIdx.from
  );
  const status = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);

  const plies = useMemo(
    () =>
      buildPuzzleMoveHistory({
        fen,
        moves,
        throughIdx: furthestSolveIdx,
      }),
    [fen, furthestSolveIdx, moves]
  );

  const interactive =
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.solved;

  const onSeek = useCallback(
    (targetSolveIdx: number) => {
      dispatch(SeekChessPuzzlePlay({ solveIdx: targetSolveIdx }));
    },
    [dispatch]
  );

  return (
    <ChessPuzzleMoveHistory
      plies={plies}
      selectedSolveIdx={solveIdx}
      interactive={interactive}
      onSeek={onSeek}
    />
  );
}
