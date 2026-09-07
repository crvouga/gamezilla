import type { Move, Square } from '@pkgs/chess-board/chess-board-types';
import { type Accessor, createMemo } from 'solid-js';

import {
  type HintStage,
  hintStageFromRoom,
} from '../../shared/puzzle-session/hint-stage';
import { puzzleNavFromState } from '../../shared/puzzle-session/puzzle-nav';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import { usePuzzlePlayerEffects } from './use-puzzle-player-effects';
import { usePuzzlePlayerHandlers } from './use-puzzle-player-handlers';

function useTrackedOnMove(
  onMove: (m: Move) => void,
  lastSubmittedToRef: { current: Square | null }
): (m: Move) => void {
  return (m: Move): void => {
    lastSubmittedToRef.current = m.to as Square;
    onMove(m);
  };
}

type ControlsArgs = {
  puzzleId: Accessor<string>;
  moves: Accessor<string>;
  solveIdx: Accessor<number>;
  furthestSolveIdx: Accessor<number>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  displayFen: Accessor<string | null>;
  expectedFromSquare: Accessor<string | null>;
  expectedToSquare: Accessor<string | null>;
  solutionRevealed: Accessor<boolean>;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  onRequestNext: () => void;
};

export function usePuzzlePlayerControls(args: ControlsArgs): {
  showCorrectFlash: Accessor<boolean>;
  solvedCrownSquare: Accessor<Square | null>;
  lastCorrectToSquare: Accessor<Square | null>;
  hintStage: Accessor<HintStage>;
  atFrontier: Accessor<boolean>;
  canGoBack: Accessor<boolean>;
  canGoForward: Accessor<boolean>;
  onBack: () => void;
  onForward: () => void;
  onMove: (m: Move) => void;
  onHint: () => void;
  onSolution: () => void;
  onRetry: () => void;
  onNext: () => void;
  backToRoot: () => void;
} {
  const lastSubmittedToRef: { current: Square | null } = { current: null };
  const effects = usePuzzlePlayerEffects({
    puzzleId: args.puzzleId,
    solveIdx: args.solveIdx,
    status: args.status,
    displayFen: args.displayFen,
    lastSubmittedToRef,
  });
  const hintStage = createMemo(() =>
    hintStageFromRoom({
      expectedFromSquare: args.expectedFromSquare(),
      solutionRevealed: args.solutionRevealed(),
    })
  );
  const nav = createMemo(() =>
    puzzleNavFromState({
      status: args.status(),
      solveIdx: args.solveIdx(),
      furthestSolveIdx: args.furthestSolveIdx(),
      moves: args.moves(),
    })
  );
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
    atFrontier: () => nav().atFrontier,
    canGoBack: () => nav().canGoBack,
    canGoForward: () => nav().canGoForward,
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
