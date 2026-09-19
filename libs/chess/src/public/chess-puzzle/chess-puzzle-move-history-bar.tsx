import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import { createMemo, type JSX } from 'solid-js';

import { buildPuzzleMoveHistory } from '../chess-puzzle-move-history';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  SeekChessPuzzlePlay,
} from '../chess-puzzle-play';
import { ChessPuzzleMoveHistory } from './chess-puzzle-move-history';

export function ChessPuzzleMoveHistoryBar(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const fen = useSpaceRoomSelector(ChessPuzzlePlayAttr.fen.from);
  const moves = useSpaceRoomSelector(ChessPuzzlePlayAttr.moves.from);
  const solveIdx = useSpaceRoomSelector(ChessPuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.furthestSolveIdx.from
  );
  const status = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);

  const plies = createMemo(() =>
    buildPuzzleMoveHistory({
      fen: fen(),
      moves: moves(),
      throughIdx: furthestSolveIdx(),
    })
  );

  const interactive = createMemo(
    () =>
      status() === CHESS_PUZZLE_PLAY_STATUS.solving ||
      status() === CHESS_PUZZLE_PLAY_STATUS.solved ||
      status() === CHESS_PUZZLE_PLAY_STATUS.revealed
  );

  const onSeek = (targetSolveIdx: number): void => {
    dispatch(SeekChessPuzzlePlay({ solveIdx: targetSolveIdx }));
  };

  return (
    <ChessPuzzleMoveHistory
      plies={plies()}
      selectedSolveIdx={solveIdx()}
      interactive={interactive()}
      onSeek={onSeek}
    />
  );
}
