import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { usePuzzleEntityAndInteractions } from './chess-puzzle-play-queries';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';

function usePuzzlePlayerModel(puzzleId: string) {
  const { rating, themes, interactions } =
    usePuzzleEntityAndInteractions(puzzleId);
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

function usePuzzlePlayerUi(
  puzzleId: string,
  onRequestNext: () => void,
  m: ReturnType<typeof usePuzzlePlayerModel>
) {
  const {
    showCorrectFlash,
    solvedCrownSquare,
    hintStage,
    onMove,
    onHint,
    onRetry,
    onNext,
    backToRoot,
  } = usePuzzlePlayerControls({
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
  const { assistant, statusKind, cellFeedback, arrows } = usePuzzlePlayerVisual(
    {
      puzzleId,
      status: m.status,
      solveIdx: m.solveIdx,
      themes: m.themes,
      layoutKey: m.layoutKey,
      orientation: m.orientation,
      showCorrectFlash,
      displayFen: m.displayFen,
      totalTokens: m.totalTokens,
      wrongFromSquare: m.wrongFromSquare,
      wrongToSquare: m.wrongToSquare,
      expectedFromSquare: m.expectedFromSquare,
      expectedToSquare: m.expectedToSquare,
      solvedCrownSquare,
      hintStage,
      rating: m.rating,
    }
  );
  return {
    rating: m.rating,
    backToRoot,
    assistant,
    statusKind,
    // Surface `null` (not '') so the screen can gate the ChessBoard render
    // until a real FEN is available; passing an empty string would let
    // `useChessGame` initialise with the standard startpos, flashing the
    // wrong board for a frame on puzzle transitions.
    displayFen: m.displayFen,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    status: m.status,
    hintStage,
    onMove,
    cellFeedback,
    arrows,
    onHint,
    onRetry,
    onNext,
  };
}

export function usePuzzlePlayerState(args: {
  puzzleId: string;
  onRequestNext: () => void;
}) {
  const m = usePuzzlePlayerModel(args.puzzleId);
  return usePuzzlePlayerUi(args.puzzleId, args.onRequestNext, m);
}

export type PuzzlePlayerChromeModel = ReturnType<typeof usePuzzlePlayerState>;
