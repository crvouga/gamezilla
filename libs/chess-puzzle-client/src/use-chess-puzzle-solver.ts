import { ChessPuzzlePlayAttr } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { SubmitChessPuzzleMove } from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import {
  countMoveTokens,
  nextSolutionUci,
  projectSolveStatus,
} from '@libs/chess-puzzle-shared/solve-projection';
import type { SolveStatus } from '@libs/chess-puzzle-shared/solve-status';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { formatUci } from '@pkgs/chess-rules-shared/uci';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleOpponentMoveStage } from './use-puzzle-opponent-move-stage';

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
    wrongUci: useSpaceRoomSelector(ChessPuzzlePlayAttr.wrongUci.from),
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    solutionRevealed: () => solutionRevealedRaw() > 0,
  };
}

export function usePuzzleSolver(args: { puzzleId: Accessor<string> }): {
  displayFen: Accessor<string | null>;
  layoutKey: Accessor<number>;
  status: Accessor<SolveStatus>;
  orientation: Accessor<'white' | 'black'>;
  onMove: (m: Move) => void;
  solveIdx: Accessor<number>;
  furthestSolveIdx: Accessor<number>;
  totalTokens: Accessor<number>;
  wrongUci: Accessor<string | null>;
  wrongFromSquare: Accessor<string | null>;
  wrongToSquare: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
  expectedToSquare: Accessor<string | null>;
  solutionUci: Accessor<string | null>;
  solutionRevealed: Accessor<boolean>;
  opponentAnimating: Accessor<boolean>;
} {
  const dispatch = useSpaceRoomDispatch();
  const room = useChessPuzzlePlayRoomSelectors();

  const onMove = (m: Move): void => {
    dispatch(SubmitChessPuzzleMove({ uci: formatUci(m) }));
  };

  const status = createMemo<SolveStatus>(() =>
    projectSolveStatus({
      roomStatus: room.roomStatus(),
      roomPuzzleId: room.roomPuzzleId(),
      puzzleId: args.puzzleId(),
    })
  );

  const totalTokens = createMemo(() => countMoveTokens(room.roomMoves()));

  // Nothing paints until the room holds this puzzle: a previous puzzle's
  // position (and orientation) never flashes first (§5 no visible flip).
  const opponentInput = createMemo(() => ({
    startFen: room.startFen(),
    moves: room.roomMoves(),
    displayFen: status() === 'loading' ? null : room.displayFen(),
    solveIdx: room.solveIdx(),
    furthestSolveIdx: room.furthestSolveIdx(),
    status: status(),
  }));
  const opponent = usePuzzleOpponentMoveStage(opponentInput);

  return {
    displayFen: () => opponent().boardFen,
    layoutKey: room.layoutKey,
    status,
    orientation: room.orientation,
    onMove,
    solveIdx: room.solveIdx,
    furthestSolveIdx: room.furthestSolveIdx,
    totalTokens,
    wrongUci: room.wrongUci,
    wrongFromSquare: room.wrongFromSquare,
    wrongToSquare: room.wrongToSquare,
    expectedFromSquare: room.expectedFromSquare,
    expectedToSquare: room.expectedToSquare,
    solutionUci: createMemo(() =>
      nextSolutionUci({
        status: status(),
        moves: room.roomMoves(),
        solveIdx: room.solveIdx(),
      })
    ),
    solutionRevealed: room.solutionRevealed,
    opponentAnimating: () => opponent().opponentAnimating,
  };
}
