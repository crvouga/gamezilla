import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import { hintStageFromRoom } from '@libs/game-puzzle-shared/hint-stage';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { puzzleNavFromState } from '@libs/game-puzzle-shared/puzzle-nav';
import { puzzleLineLayout } from '@pkgs/turn-game-shared/game-puzzles';
import { type Accessor, createMemo } from 'solid-js';
import { usePuzzleGame } from './puzzle-game-context';
import { usePuzzlePlayerEffects } from './use-puzzle-player-effects';
import { usePuzzlePlayerHandlers } from './use-puzzle-player-handlers';

type ControlsArgs = {
  puzzleId: Accessor<string>;
  moves: Accessor<string>;
  solveIdx: Accessor<number>;
  furthestSolveIdx: Accessor<number>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  hintFrom: Accessor<string | null>;
  solutionRevealed: Accessor<boolean>;
  onMoveRaw: (action: string) => void;
  setLastAction: (action: string) => void;
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
  onMove: (action: string) => void;
  onHint: () => void;
  onSolution: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onNext: () => void;
  backToRoot: () => void;
} {
  const firstSolveIdx = puzzleLineLayout(usePuzzleGame().game.puzzles).start;
  usePuzzlePlayerEffects({
    puzzleId: args.puzzleId,
    solveIdx: args.solveIdx,
    status: args.status,
  });
  const hintStage = createMemo(() =>
    hintStageFromRoom({
      status: args.status(),
      expectedFromSquare: args.hintFrom(),
      solutionRevealed: args.solutionRevealed(),
    })
  );
  const nav = createMemo(() =>
    puzzleNavFromState({
      status: args.status(),
      solveIdx: args.solveIdx(),
      furthestSolveIdx: args.furthestSolveIdx(),
      moves: args.moves(),
      firstSolveIdx,
    })
  );
  const handlers = usePuzzlePlayerHandlers({
    puzzleId: args.puzzleId,
    status: args.status,
    hintStage,
    onMoveRaw: args.onMoveRaw,
    setLastAction: args.setLastAction,
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
