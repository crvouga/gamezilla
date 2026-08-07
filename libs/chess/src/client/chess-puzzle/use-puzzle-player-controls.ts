import type { Move, Square } from '@pkgs/chess-board/chess-board-types';
import { useCallback, useRef } from 'react';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { type HintStage, hintStageFromRoom } from './use-hint-stage';
import { puzzleNavFromState } from './use-puzzle-nav';
import { usePuzzlePlayerEffects } from './use-puzzle-player-effects';
import { usePuzzlePlayerHandlers } from './use-puzzle-player-handlers';

function useTrackedOnMove(
  onMove: (m: Move) => void,
  lastSubmittedToRef: ReturnType<typeof useRef<Square | null>>
): (m: Move) => void {
  return useCallback(
    (m: Move) => {
      lastSubmittedToRef.current = m.to as Square;
      onMove(m);
    },
    [lastSubmittedToRef, onMove]
  );
}

type ControlsArgs = {
  puzzleId: string;
  moves: string;
  solveIdx: number;
  furthestSolveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
  solutionRevealed: boolean;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  onRequestNext: () => void;
};

export function usePuzzlePlayerControls(args: ControlsArgs): {
  showCorrectFlash: boolean;
  solvedCrownSquare: ReturnType<
    typeof usePuzzlePlayerEffects
  >['solvedCrownSquare'];
  lastCorrectToSquare: ReturnType<
    typeof usePuzzlePlayerEffects
  >['lastCorrectToSquare'];
  hintStage: HintStage;
  atFrontier: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onMove: (m: Move) => void;
  onHint: () => void;
  onSolution: () => void;
  onRetry: () => void;
  onNext: () => void;
  backToRoot: () => void;
} {
  const lastSubmittedToRef = useRef<Square | null>(null);
  const effects = usePuzzlePlayerEffects({
    puzzleId: args.puzzleId,
    solveIdx: args.solveIdx,
    status: args.status,
    displayFen: args.displayFen,
    lastSubmittedToRef,
  });
  const hintStage = hintStageFromRoom({
    expectedFromSquare: args.expectedFromSquare,
    solutionRevealed: args.solutionRevealed,
  });
  const nav = puzzleNavFromState({
    status: args.status,
    solveIdx: args.solveIdx,
    furthestSolveIdx: args.furthestSolveIdx,
    moves: args.moves,
  });
  const handlers = usePuzzlePlayerHandlers({
    status: args.status,
    hintStage,
    onMoveRaw: args.onMoveRaw,
    setLastUci: args.setLastUci,
    appendUsedHint: args.appendUsedHint,
    appendAbandoned: args.appendAbandoned,
    onRequestNext: args.onRequestNext,
  });
  const onMove = useTrackedOnMove(handlers.onMove, lastSubmittedToRef);
  return {
    ...effects,
    hintStage,
    ...nav,
    onMove,
    onHint: handlers.onHint,
    onSolution: handlers.onSolution,
    onRetry: handlers.onRetry,
    onNext: handlers.onNext,
    onBack: handlers.onBack,
    onForward: handlers.onForward,
    backToRoot: handlers.backToRoot,
  };
}
