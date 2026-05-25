import type { Move } from '@pkgs/chess-board/chess-board-types';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { useHintStage, type HintStage } from './use-hint-stage';
import { usePuzzlePlayerEffects } from './use-puzzle-player-effects';
import { usePuzzlePlayerHandlers } from './use-puzzle-player-handlers';

export function usePuzzlePlayerControls(args: {
  puzzleId: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  expectedFromSquare: string | null;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  onRequestNext: () => void;
}): {
  showCorrectFlash: boolean;
  solvedCrownSquare: ReturnType<
    typeof usePuzzlePlayerEffects
  >['solvedCrownSquare'];
  hintStage: HintStage;
  onMove: (m: Move) => void;
  onHint: () => void;
  onRetry: () => void;
  onNext: () => void;
  backToRoot: () => void;
} {
  const { puzzleId, solveIdx, status, displayFen, onMoveRaw, setLastUci } =
    args;
  const { showCorrectFlash, solvedCrownSquare } = usePuzzlePlayerEffects({
    puzzleId,
    solveIdx,
    status,
    displayFen,
  });
  const { hintStage, showSolution } = useHintStage({
    expectedFromSquare: args.expectedFromSquare,
  });
  const { onMove, onHint, onRetry, onNext, backToRoot } =
    usePuzzlePlayerHandlers({
      status,
      hintStage,
      showSolution,
      onMoveRaw,
      setLastUci,
      appendUsedHint: args.appendUsedHint,
      appendAbandoned: args.appendAbandoned,
      onRequestNext: args.onRequestNext,
    });
  return {
    showCorrectFlash,
    solvedCrownSquare,
    hintStage,
    onMove,
    onHint,
    onRetry,
    onNext,
    backToRoot,
  };
}
