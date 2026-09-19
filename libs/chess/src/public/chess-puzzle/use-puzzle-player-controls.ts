import type { Move } from '@pkgs/chess-board/chess-board-types';
import { type Accessor, createMemo } from 'solid-js';

import {
  type HintStage,
  hintStageFromRoom,
} from '../../shared/puzzle-session/hint-stage';
import { puzzleNavFromState } from '../../shared/puzzle-session/puzzle-nav';
import type { ChessPuzzlePlayStatus } from '../chess-puzzle-play';
import { usePuzzlePlayerEffects } from './use-puzzle-player-effects';
import { usePuzzlePlayerHandlers } from './use-puzzle-player-handlers';

type ControlsArgs = {
  puzzleId: Accessor<string>;
  moves: Accessor<string>;
  solveIdx: Accessor<number>;
  furthestSolveIdx: Accessor<number>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  expectedFromSquare: Accessor<string | null>;
  solutionRevealed: Accessor<boolean>;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  onRequestNext: () => void;
};

export function usePuzzlePlayerControls(args: ControlsArgs): {
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
  onSkip: () => void;
  onNext: () => void;
  backToRoot: () => void;
} {
  usePuzzlePlayerEffects({
    puzzleId: args.puzzleId,
    solveIdx: args.solveIdx,
    status: args.status,
  });
  const hintStage = createMemo(() =>
    hintStageFromRoom({
      status: args.status(),
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
    puzzleId: args.puzzleId,
    status: args.status,
    hintStage,
    onMoveRaw: args.onMoveRaw,
    setLastUci: args.setLastUci,
    appendUsedHint: args.appendUsedHint,
    onRequestNext: args.onRequestNext,
  });
  return {
    hintStage,
    atFrontier: () => nav().atFrontier,
    canGoBack: () => nav().canGoBack,
    canGoForward: () => nav().canGoForward,
    onMove: handlers.onMove,
    onHint: handlers.onHint,
    onSolution: handlers.onSolution,
    onRetry: handlers.onRetry,
    onSkip: handlers.onSkip,
    onNext: handlers.onNext,
    onBack: handlers.onBack,
    onForward: handlers.onForward,
    backToRoot: handlers.backToRoot,
  };
}
