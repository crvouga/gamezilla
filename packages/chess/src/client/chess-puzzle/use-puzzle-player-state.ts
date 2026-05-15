import { useChessPuzzleInteractionRecorder } from './use-chess-puzzle-interaction-recorder';
import { usePuzzleEntityAndInteractions } from './chess-puzzle-play-queries';
import { usePuzzleSolver } from './use-chess-puzzle-solver';
import { usePuzzlePlayerControls } from './use-puzzle-player-controls';
import { usePuzzlePlayerVisual } from './use-puzzle-player-visual';

function usePuzzlePlayerModel(puzzleId: string) {
  const { fen, movesStr, rating, themes, interactions } =
    usePuzzleEntityAndInteractions(puzzleId);
  const {
    displayFen,
    layoutKey,
    status,
    orientation,
    onMove: onMoveRaw,
    solveIdx,
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
  } = usePuzzleSolver({ fen, movesStr, puzzleId });
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
    wrongFromSquare,
    wrongToSquare,
    expectedFromSquare,
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
    onMove,
    onHint,
    onRetry,
    onNext,
    backToRoot,
  } = usePuzzlePlayerControls({
    solveIdx: m.solveIdx,
    status: m.status,
    displayFen: m.displayFen,
    onMoveRaw: m.onMoveRaw,
    setLastUci: m.setLastUci,
    appendUsedHint: m.appendUsedHint,
    appendAbandoned: m.appendAbandoned,
    onRequestNext,
  });
  const { assistant, statusKind, cellFeedback } = usePuzzlePlayerVisual({
    puzzleId,
    status: m.status,
    solveIdx: m.solveIdx,
    themes: m.themes,
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    showCorrectFlash,
    interactions: m.interactions,
    wrongFromSquare: m.wrongFromSquare,
    wrongToSquare: m.wrongToSquare,
    expectedFromSquare: m.expectedFromSquare,
    solvedCrownSquare,
  });
  return {
    rating: m.rating,
    backToRoot,
    assistant,
    statusKind,
    displayFen: m.displayFen ?? '',
    layoutKey: m.layoutKey,
    orientation: m.orientation,
    status: m.status,
    onMove,
    cellFeedback,
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
