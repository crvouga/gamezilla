import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import { PUZZLE_PLAY_STATUS } from '@libs/game-puzzle-shared/play-attr';
import {
  ClearPuzzlePlay,
  RequestPuzzleHint,
  ResetPuzzlePlay,
  RevealPuzzleSolution,
  ShowPuzzleSolution,
  SkipPuzzlePlay,
  StepBackPuzzlePlay,
  StepForwardPuzzlePlay,
} from '@libs/game-puzzle-shared/play-messages';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import type { Accessor } from 'solid-js';

/**
 * An attempt is in flight while the player is still moving or has just gone
 * wrong. Leaving it keeps it pending in the room (restored on return, §5);
 * only Skip forfeits it.
 */
export function isUnfinishedPuzzleStatus(
  status: PuzzlePlayStatus | 'loading'
): boolean {
  return (
    status === PUZZLE_PLAY_STATUS.solving || status === PUZZLE_PLAY_STATUS.wrong
  );
}

/** Next is offered once the attempt is over (or the puzzle cannot be played). */
export function isFinishedPuzzleStatus(
  status: PuzzlePlayStatus | 'loading'
): boolean {
  return (
    status === PUZZLE_PLAY_STATUS.solved ||
    status === PUZZLE_PLAY_STATUS.revealed ||
    status === PUZZLE_PLAY_STATUS.skipped ||
    status === PUZZLE_PLAY_STATUS.invalid
  );
}

type HandlersArgs = {
  puzzleId: Accessor<string>;
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  hintStage: Accessor<HintStage>;
  onMoveRaw: (action: string) => void;
  setLastAction: (action: string) => void;
  appendUsedHint: () => Promise<void>;
  onRequestNext: () => void;
};

function useHintSolutionHandlers(args: {
  hintStage: Accessor<HintStage>;
  appendUsedHint: () => Promise<void>;
}): { onHint: () => void; onSolution: () => void } {
  const dispatch = useSpaceRoomDispatch();

  const onHint = (): void => {
    const hintStage = args.hintStage();
    if (hintStage === 'none') {
      dispatch(RequestPuzzleHint({}));
      void args.appendUsedHint();
      return;
    }
    if (hintStage === 'highlight') {
      dispatch(RevealPuzzleSolution({}));
      return;
    }
    // Already arrowed: the last step of the same button is §6 "Show solution".
    dispatch(ShowPuzzleSolution({}));
  };

  /** §6 "Show solution": the room plays the rest of the line out, then review. */
  const onSolution = (): void => {
    dispatch(ShowPuzzleSolution({}));
  };

  return { onHint, onSolution };
}

export function usePuzzlePlayerHandlers(args: HandlersArgs): {
  onMove: (action: string) => void;
  onHint: () => void;
  onSolution: () => void;
  onRetry: () => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
  onForward: () => void;
  backToRoot: () => void;
} {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();
  const { onHint, onSolution } = useHintSolutionHandlers({
    hintStage: args.hintStage,
    appendUsedHint: args.appendUsedHint,
  });

  const onMove = (action: string): void => {
    args.setLastAction(action);
    args.onMoveRaw(action);
  };

  /** An unfinished attempt stays pending in the room; a finished one is cleared. */
  const backToRoot = (): void => {
    if (!isUnfinishedPuzzleStatus(args.status())) {
      dispatch(ClearPuzzlePlay({}));
    }
    gameScreen.showChoices();
  };

  const onRetry = (): void => {
    dispatch(ResetPuzzlePlay({}));
  };

  /** Skip is a terminal forfeit; the recorder finalizes it from `skipped`. */
  const onSkip = (): void => {
    if (!isUnfinishedPuzzleStatus(args.status())) return;
    dispatch(SkipPuzzlePlay({}));
  };

  /**
   * One advance per finished puzzle: a second tap (double tap, or the result
   * panel and the action bar both pressed) before the next puzzle lands is
   * ignored.
   */
  const nextRequestedForRef: { current: string | null } = { current: null };
  const onNext = (): void => {
    if (!isFinishedPuzzleStatus(args.status())) return;
    if (nextRequestedForRef.current === args.puzzleId()) return;
    nextRequestedForRef.current = args.puzzleId();
    dispatch(ClearPuzzlePlay({}));
    args.onRequestNext();
  };

  const onBack = (): void => {
    dispatch(StepBackPuzzlePlay({}));
  };

  const onForward = (): void => {
    dispatch(StepForwardPuzzlePlay({}));
  };

  return {
    onMove,
    onHint,
    onSolution,
    onRetry,
    onSkip,
    onNext,
    onBack,
    onForward,
    backToRoot,
  };
}
