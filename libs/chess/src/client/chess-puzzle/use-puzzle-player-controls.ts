import type { Move, Square } from '@pkgs/chess-board/chess-board-types';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { useCallback, useRef } from 'react';
import { useHintStage, type HintStage } from './use-hint-stage';
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

export function usePuzzlePlayerControls(args: {
  puzzleId: string;
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  expectedFromSquare: string | null;
  expectedToSquare: string | null;
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
  lastCorrectToSquare: ReturnType<
    typeof usePuzzlePlayerEffects
  >['lastCorrectToSquare'];
  boardShakeNonce: number;
  hintStage: HintStage;
  onMove: (m: Move) => void;
  onHint: () => void;
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
  const { hintStage, showSolution } = useHintStage({
    expectedFromSquare: args.expectedFromSquare,
  });
  const handlers = usePuzzlePlayerHandlers({
    status: args.status,
    hintStage,
    showSolution,
    onMoveRaw: args.onMoveRaw,
    setLastUci: args.setLastUci,
    appendUsedHint: args.appendUsedHint,
    appendAbandoned: args.appendAbandoned,
    onRequestNext: args.onRequestNext,
  });
  const { onMove: handlerOnMove, ...handlerRest } = handlers;
  const onMove = useTrackedOnMove(handlerOnMove, lastSubmittedToRef);
  return { ...effects, hintStage, onMove, ...handlerRest };
}
