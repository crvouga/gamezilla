import {
  countMoveTokens,
  nextSolutionUci,
  projectBoardFen,
  projectSolveStatus,
} from '@libs/chess-puzzle-shared/solve-projection';
import { PuzzlePlayAttr } from '@libs/game-puzzle-shared/play-attr';
import { SubmitPuzzleMove } from '@libs/game-puzzle-shared/play-messages';
import type { SolveStatus } from '@libs/game-puzzle-shared/solve-status';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { formatUci } from '@pkgs/chess-rules-shared/uci';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleOpponentMoveStage } from './use-puzzle-opponent-move-stage';

function useChessPuzzlePlayRoomSelectors() {
  const roomStatus = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(PuzzlePlayAttr.puzzleId.from);
  const startFen = useSpaceRoomSelector(PuzzlePlayAttr.position.from);
  const displayFen = useSpaceRoomSelector(PuzzlePlayAttr.displayPosition.from);
  const layoutKey = useSpaceRoomSelector(PuzzlePlayAttr.layoutKey.from);
  const orientation = useSpaceRoomSelector(PuzzlePlayAttr.solverSide.from);
  const solveIdx = useSpaceRoomSelector(PuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    PuzzlePlayAttr.furthestSolveIdx.from
  );
  const roomMoves = useSpaceRoomSelector(PuzzlePlayAttr.line.from);
  const wrongToSquare = useSpaceRoomSelector(PuzzlePlayAttr.wrongMark.from);
  const expectedFromSquare = useSpaceRoomSelector(PuzzlePlayAttr.hintFrom.from);
  const expectedToSquare = useSpaceRoomSelector(PuzzlePlayAttr.hintTo.from);
  const solutionRevealedRaw = useSpaceRoomSelector(
    PuzzlePlayAttr.solutionRevealed.from
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
    wrongUci: useSpaceRoomSelector(PuzzlePlayAttr.wrongAction.from),
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    solutionRevealed: () => solutionRevealedRaw() > 0,
  };
}

export function usePuzzleSolver(args: { puzzleId: Accessor<string> }): {
  displayFen: Accessor<string | null>;
  /** What the board paints: `displayFen`, plus a wrong move awaiting retry. */
  boardFen: Accessor<string | null>;
  layoutKey: Accessor<number>;
  status: Accessor<SolveStatus>;
  orientation: Accessor<'white' | 'black'>;
  onMove: (m: Move) => void;
  solveIdx: Accessor<number>;
  furthestSolveIdx: Accessor<number>;
  totalTokens: Accessor<number>;
  wrongUci: Accessor<string | null>;
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
    dispatch(SubmitPuzzleMove({ uci: formatUci(m) }));
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

  const displayFen = (): string | null => opponent().boardFen;

  return {
    displayFen,
    boardFen: createMemo(() =>
      projectBoardFen({
        status: status(),
        fen: displayFen(),
        wrongUci: room.wrongUci(),
      })
    ),
    layoutKey: room.layoutKey,
    status,
    orientation: room.orientation,
    onMove,
    solveIdx: room.solveIdx,
    furthestSolveIdx: room.furthestSolveIdx,
    totalTokens,
    wrongUci: room.wrongUci,
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
