import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/public/room/use-space-room-selector';
import type { Move } from '@pkgs/chess-board/chess-board-types';
import { useCallback } from 'react';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  SubmitChessPuzzleMove,
} from '../chess-puzzle-play';
import { uciFromMove } from './chess-puzzle-play-chess-utils';
import type { SolveStatus } from './solve-status';
import { usePuzzleOpponentMoveStage } from './use-puzzle-opponent-move-stage';

export type { SolveStatus } from './solve-status';

function useChessPuzzlePlayRoomSelectors() {
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  const startFen = useSpaceRoomSelector(ChessPuzzlePlayAttr.fen.from);
  const displayFen = useSpaceRoomSelector(ChessPuzzlePlayAttr.displayFen.from);
  const layoutKey = useSpaceRoomSelector(ChessPuzzlePlayAttr.layoutKey.from);
  const orientation = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.orientation.from
  );
  const solveIdx = useSpaceRoomSelector(ChessPuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.furthestSolveIdx.from
  );
  const roomMoves = useSpaceRoomSelector(ChessPuzzlePlayAttr.moves.from);
  const wrongFromSquare = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.wrongFromSquare.from
  );
  const wrongToSquare = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.wrongToSquare.from
  );
  const expectedFromSquare = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.expectedFromSquare.from
  );
  const expectedToSquare = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.expectedToSquare.from
  );
  const solutionRevealedRaw = useSpaceRoomSelector(
    ChessPuzzlePlayAttr.solutionRevealed.from
  );
  return {
    roomStatus,
    roomPuzzleId,
    startFen,
    displayFen,
    layoutKey,
    orientation,
    solveIdx,
    furthestSolveIdx,
    roomMoves,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    solutionRevealed: solutionRevealedRaw > 0,
  };
}

function projectSolveStatus(
  roomStatus: ReturnType<typeof useChessPuzzlePlayRoomSelectors>['roomStatus'],
  roomPuzzleId: string | null,
  puzzleId: string
): SolveStatus {
  if (
    roomStatus === CHESS_PUZZLE_PLAY_STATUS.idle ||
    roomPuzzleId !== puzzleId
  ) {
    return 'loading';
  }
  return roomStatus;
}

function countMoveTokens(roomMoves: string): number {
  const trimmed = roomMoves.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Bridges the puzzle play screen to the server-authoritative FSM in
 * {@link ChessPuzzlePlayAttr}. `onMove` dispatches `SubmitChessPuzzleMove`;
 * the server validates host identity, expected token, and move legality
 * before mutating room state.
 *
 * Note: starting a session (`StartChessPuzzlePlay`) is owned by
 * `PuzzlePlayScreen` — keeping a single dispatcher prevents a race where
 * both the screen and this hook fire `Start` in the same idle window.
 */
export function usePuzzleSolver(args: { puzzleId: string }): {
  displayFen: string | null;
  /** Bumps on wrong move / reset so the board remounts when FEN string is unchanged. */
  layoutKey: number;
  status: SolveStatus;
  orientation: 'white' | 'black';
  onMove: (m: Move) => void;
  solveIdx: number;
  furthestSolveIdx: number;
  totalTokens: number;
  wrongFromSquare: string | null;
  wrongToSquare: string | null;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
  solutionRevealed: boolean;
  /** True while opponent opening/reply is staged on the board. */
  opponentAnimating: boolean;
} {
  const { puzzleId } = args;
  const dispatch = useSpaceRoomDispatch();
  const room = useChessPuzzlePlayRoomSelectors();

  const onMove = useCallback(
    (m: Move) => {
      dispatch(SubmitChessPuzzleMove({ uci: uciFromMove(m) }));
    },
    [dispatch]
  );

  const status = projectSolveStatus(
    room.roomStatus,
    room.roomPuzzleId,
    puzzleId
  );
  const totalTokens = countMoveTokens(room.roomMoves);

  const { boardFen, opponentAnimating } = usePuzzleOpponentMoveStage({
    startFen: room.startFen,
    moves: room.roomMoves,
    displayFen: room.displayFen,
    solveIdx: room.solveIdx,
    furthestSolveIdx: room.furthestSolveIdx,
    status,
  });

  return {
    displayFen: boardFen,
    layoutKey: room.layoutKey,
    status,
    orientation: room.orientation,
    onMove,
    solveIdx: room.solveIdx,
    furthestSolveIdx: room.furthestSolveIdx,
    totalTokens,
    wrongFromSquare: room.wrongFromSquare,
    wrongToSquare: room.wrongToSquare,
    expectedFromSquare: room.expectedFromSquare,
    expectedToSquare: room.expectedToSquare,
    solutionRevealed: room.solutionRevealed,
    opponentAnimating,
  };
}
