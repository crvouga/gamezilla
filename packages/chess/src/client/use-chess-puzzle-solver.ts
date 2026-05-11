import type { Move } from './chess-board-types';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
  SubmitChessPuzzleMove,
  type ChessPuzzlePlayStatus,
} from '../shared/chess-puzzle-play';
import { useCallback, useEffect } from 'react';

import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@gamezilla/spaces/client/use-space-room-selector';
import { uciFromMove } from './chess-puzzle-play-chess-utils';

/**
 * UI-facing status. `'loading'` is a client-side projection of the room's
 * `'idle'` status — there is no separate `'loading'` state on the wire.
 */
export type SolveStatus = 'loading' | ChessPuzzlePlayStatus;

/**
 * Bridges the puzzle play screen to the server-authoritative FSM in
 * {@link ChessPuzzlePlayAttr}. Auto-dispatches `StartChessPuzzlePlay` when the
 * room is `idle` and the puzzle entity (FEN + moves) is available locally.
 * `onMove` dispatches `SubmitChessPuzzleMove`; the server validates host
 * identity, expected token, and move legality before mutating room state.
 */
export function usePuzzleSolver(args: {
  fen: string;
  movesStr: string;
  puzzleId: string;
}): {
  displayFen: string | null;
  /** Bumps on wrong move / reset so the board remounts when FEN string is unchanged. */
  layoutKey: number;
  status: SolveStatus;
  /** Side the human sits on for this puzzle — fixed for the session, not derived from live FEN. */
  orientation: 'white' | 'black';
  onMove: (m: Move) => void;
} {
  const { fen, movesStr, puzzleId } = args;
  const dispatch = useSpaceRoomDispatch();

  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const displayFen = useSpaceRoomSelector(ChessPuzzlePlayAttr.displayFen.from);
  const layoutKey = useSpaceRoomSelector(ChessPuzzlePlayAttr.layoutKey.from);
  const orientation = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.orientation.from
  );

  useEffect(() => {
    if (roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) return;
    if (fen.length === 0 || movesStr.length === 0) return;
    dispatch(StartChessPuzzlePlay({ puzzleId, fen, moves: movesStr }));
  }, [dispatch, fen, movesStr, puzzleId, roomStatus]);

  const onMove = useCallback(
    (m: Move) => {
      dispatch(SubmitChessPuzzleMove({ uci: uciFromMove(m) }));
    },
    [dispatch]
  );

  const status: SolveStatus =
    roomStatus === CHESS_PUZZLE_PLAY_STATUS.idle || roomPuzzleId !== puzzleId
      ? 'loading'
      : roomStatus;

  return { displayFen, layoutKey, status, orientation, onMove };
}
