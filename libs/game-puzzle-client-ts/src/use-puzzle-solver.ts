import { PuzzlePlayAttr } from '@libs/game-puzzle-shared-ts/play-attr';
import { SubmitPuzzleMove } from '@libs/game-puzzle-shared-ts/play-messages';
import {
  nextSolutionAction,
  projectBoardPosition,
  projectSolveStatus,
} from '@libs/game-puzzle-shared-ts/solve-projection';
import type { SolveStatus } from '@libs/game-puzzle-shared-ts/solve-status';
import { lineLength } from '@libs/game-puzzle-shared-ts/step';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzleOpponentMoveStage } from './use-puzzle-opponent-move-stage';

function usePuzzlePlayRoomSelectors() {
  const roomStatus = useSpaceRoomSelector(PuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(PuzzlePlayAttr.puzzleId.from);
  const startPosition = useSpaceRoomSelector(PuzzlePlayAttr.position.from);
  const displayPosition = useSpaceRoomSelector(
    PuzzlePlayAttr.displayPosition.from
  );
  const layoutKey = useSpaceRoomSelector(PuzzlePlayAttr.layoutKey.from);
  const orientation = useSpaceRoomSelector(PuzzlePlayAttr.solverSide.from);
  const solveIdx = useSpaceRoomSelector(PuzzlePlayAttr.solveIdx.from);
  const furthestSolveIdx = useSpaceRoomSelector(
    PuzzlePlayAttr.furthestSolveIdx.from
  );
  const roomMoves = useSpaceRoomSelector(PuzzlePlayAttr.line.from);
  const wrongMark = useSpaceRoomSelector(PuzzlePlayAttr.wrongMark.from);
  const hintFrom = useSpaceRoomSelector(PuzzlePlayAttr.hintFrom.from);
  const hintTo = useSpaceRoomSelector(PuzzlePlayAttr.hintTo.from);
  const solutionRevealedRaw = useSpaceRoomSelector(
    PuzzlePlayAttr.solutionRevealed.from
  );
  return {
    roomStatus,
    roomPuzzleId,
    startPosition,
    displayPosition,
    layoutKey,
    orientation,
    solveIdx,
    furthestSolveIdx,
    roomMoves,
    wrongAction: useSpaceRoomSelector(PuzzlePlayAttr.wrongAction.from),
    wrongMark,
    hintFrom,
    hintTo,
    solutionRevealed: () => solutionRevealedRaw() > 0,
  };
}

export function usePuzzleSolver(args: { puzzleId: Accessor<string> }): {
  displayPosition: Accessor<string | null>;
  /** What the board paints: `displayPosition`, plus a wrong move awaiting retry. */
  boardPosition: Accessor<string | null>;
  layoutKey: Accessor<number>;
  status: Accessor<SolveStatus>;
  orientation: Accessor<'white' | 'black'>;
  onMove: (action: string) => void;
  solveIdx: Accessor<number>;
  furthestSolveIdx: Accessor<number>;
  totalTokens: Accessor<number>;
  wrongAction: Accessor<string | null>;
  wrongMark: Accessor<string | null>;
  hintFrom: Accessor<string | null>;
  hintTo: Accessor<string | null>;
  nextAction: Accessor<string | null>;
  solutionRevealed: Accessor<boolean>;
  opponentAnimating: Accessor<boolean>;
} {
  const dispatch = useSpaceRoomDispatch();
  const room = usePuzzlePlayRoomSelectors();
  const { game } = usePuzzleGame();

  const onMove = (action: string): void => {
    dispatch(SubmitPuzzleMove({ uci: action }));
  };

  const status = createMemo<SolveStatus>(() =>
    projectSolveStatus({
      roomStatus: room.roomStatus(),
      roomPuzzleId: room.roomPuzzleId(),
      puzzleId: args.puzzleId(),
    })
  );

  const totalTokens = createMemo(() => lineLength(room.roomMoves()));

  // Nothing paints until the room holds this puzzle: a previous puzzle's
  // position (and orientation) never flashes first (§5 no visible flip).
  const opponentInput = createMemo(() => ({
    startPosition: room.startPosition(),
    moves: room.roomMoves(),
    displayPosition: status() === 'loading' ? null : room.displayPosition(),
    solveIdx: room.solveIdx(),
    furthestSolveIdx: room.furthestSolveIdx(),
    status: status(),
  }));
  const opponent = usePuzzleOpponentMoveStage(opponentInput);

  const displayPosition = (): string | null => opponent().boardPosition;

  return {
    displayPosition,
    boardPosition: createMemo(() =>
      projectBoardPosition(game, {
        status: status(),
        position: displayPosition(),
        wrongAction: room.wrongAction(),
      })
    ),
    layoutKey: room.layoutKey,
    status,
    orientation: room.orientation,
    onMove,
    solveIdx: room.solveIdx,
    furthestSolveIdx: room.furthestSolveIdx,
    totalTokens,
    wrongAction: room.wrongAction,
    wrongMark: room.wrongMark,
    hintFrom: room.hintFrom,
    hintTo: room.hintTo,
    nextAction: createMemo(() =>
      nextSolutionAction({
        status: status(),
        moves: room.roomMoves(),
        solveIdx: room.solveIdx(),
      })
    ),
    solutionRevealed: room.solutionRevealed,
    opponentAnimating: () => opponent().opponentAnimating,
  };
}
