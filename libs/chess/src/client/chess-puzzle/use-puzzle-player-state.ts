import { useEffect, useMemo } from 'react';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces/client/room/use-space-room-selector';

import {
  CHESS_PUZZLE_PLAY_STATUS,
  ChessPuzzlePlayAttr,
  StartChessPuzzlePlay,
} from '../../shared/chess-puzzle-play';
import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { usePuzzleEntityAndInteractions } from './chess-puzzle-play-queries';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';

/**
 * Dispatches `StartChessPuzzlePlay` once the room is idle for `puzzleId`
 * and the entity data has been hydrated. Lives inside the player (not the
 * screen) so the screen never needs its own duplicate `usePuzzleEntity`
 * subscription — the player already owns one via
 * {@link usePuzzleEntityAndInteractions}.
 */
function useStartPuzzleSessionOnMount(args: {
  puzzleId: string;
  fen: string;
  movesStr: string;
}): void {
  const { puzzleId, fen, movesStr } = args;
  const dispatch = useSpaceRoomDispatch();
  const roomStatus = useSpaceRoomSelector(ChessPuzzlePlayAttr.status.from);
  const roomPuzzleId = useSpaceRoomSelector(ChessPuzzlePlayAttr.puzzleId.from);
  useEffect(() => {
    if (roomStatus !== CHESS_PUZZLE_PLAY_STATUS.idle) return;
    if (fen.length === 0 || movesStr.length === 0) return;
    if (roomPuzzleId !== null) return;
    dispatch(StartChessPuzzlePlay({ puzzleId, fen, moves: movesStr }));
  }, [dispatch, fen, movesStr, puzzleId, roomPuzzleId, roomStatus]);
}

function usePuzzlePlayerModel(puzzleId: string) {
  const { fen, movesStr, rating, themes, interactions } =
    usePuzzleEntityAndInteractions(puzzleId);
  useStartPuzzleSessionOnMount({ puzzleId, fen, movesStr });
  const {
    displayFen,
    layoutKey,
    status,
    orientation,
    onMove: onMoveRaw,
    solveIdx,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
  } = usePuzzleSolver({ puzzleId });
  const { appendUsedHint, appendAbandoned, setLastUci } =
    useChessPuzzleInteractionRecorder({
      puzzleId,
      puzzleRating: rating,
      status,
      solveIdx,
      interactions,
    });
  return {
    rating,
    themes,
    interactions,
    displayFen,
    layoutKey,
    status,
    orientation,
    onMoveRaw,
    solveIdx,
    totalTokens,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
    expectedToSquare,
    appendUsedHint,
    appendAbandoned,
    setLastUci,
  };
}

type PlayerControls = ReturnType<typeof usePuzzlePlayerControls>;
type PlayerVisual = ReturnType<typeof usePuzzlePlayerVisual>;

function frozenPlayerModel(args: {
  m: ReturnType<typeof usePuzzlePlayerModel>;
  controls: PlayerControls;
  visual: PlayerVisual;
}) {
  const { m, controls, visual } = args;
  return {
    rating: m.rating,
    backToRoot: controls.backToRoot,
    assistant: visual.assistant,
    statusKind: visual.statusKind,
    // `null` (not '') so the screen can gate the ChessBoard render
    // until a real FEN is available; passing an empty string would let
    // `useChessGame` initialise with the standard startpos, flashing
    // the wrong board for a frame on puzzle transitions.
    displayFen: m.displayFen,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    status: m.status,
    hintStage: controls.hintStage,
    onMove: controls.onMove,
    cellFeedback: visual.cellFeedback,
    arrows: visual.arrows,
    onHint: controls.onHint,
    onRetry: controls.onRetry,
    onNext: controls.onNext,
  };
}

function usePuzzlePlayerUi(
  puzzleId: string,
  onRequestNext: () => void,
  m: ReturnType<typeof usePuzzlePlayerModel>
) {
  const controls = usePuzzlePlayerControls({
    puzzleId,
    solveIdx: m.solveIdx,
    status: m.status,
    displayFen: m.displayFen,
    expectedFromSquare: m.expectedFromSquare,
    onMoveRaw: m.onMoveRaw,
    setLastUci: m.setLastUci,
    appendUsedHint: m.appendUsedHint,
    appendAbandoned: m.appendAbandoned,
    onRequestNext,
  });
  const visual = usePuzzlePlayerVisual({
    puzzleId,
    status: m.status,
    solveIdx: m.solveIdx,
    themes: m.themes,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    showCorrectFlash: controls.showCorrectFlash,
    displayFen: m.displayFen,
    totalTokens: m.totalTokens,
    wrongFromSquare: m.wrongFromSquare,
    wrongToSquare: m.wrongToSquare,
    expectedFromSquare: m.expectedFromSquare,
    expectedToSquare: m.expectedToSquare,
    solvedCrownSquare: controls.solvedCrownSquare,
    hintStage: controls.hintStage,
    rating: m.rating,
  });
  // Freeze the player's exposed shape every render so memoized children
  // (`PuzzleBoardSlot`, eventually `ChessPuzzleActionBar`) skip identical
  // prop bags. All callers go through this single object — no spread.
  return useMemo(
    () => frozenPlayerModel({ m, controls, visual }),
    [m, controls, visual]
  );
}

export function usePuzzlePlayerState(args: {
  puzzleId: string;
  onRequestNext: () => void;
}) {
  const m = usePuzzlePlayerModel(args.puzzleId);
  return usePuzzlePlayerUi(args.puzzleId, args.onRequestNext, m);
}

export type PuzzlePlayerChromeModel = ReturnType<typeof usePuzzlePlayerState>;
