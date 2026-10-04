import type { ChessPuzzlePlayStatus } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import { CHESS_PUZZLE_PLAY_STATUS } from '@libs/chess-puzzle-shared/chess-puzzle-play-attr';
import {
  ClearChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  RevealChessPuzzleSolution,
  ShowChessPuzzleSolution,
  SkipChessPuzzlePlay,
  StepBackChessPuzzlePlay,
  StepForwardChessPuzzlePlay,
} from '@libs/chess-puzzle-shared/chess-puzzle-play-messages';
import type { HintStage } from '@libs/chess-puzzle-shared/hint-stage';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '@libs/chess-shared/chess-main-menu';
import { useSpaceRoomDispatch } from '@libs/spaces-client/use-space-room-selector';
import type { Move } from '@pkgs/chess-board-core-shared/types';
import { formatUci } from '@pkgs/chess-rules-shared/uci';
import type { Accessor } from 'solid-js';

/**
 * An attempt is in flight while the player is still moving or has just gone
 * wrong. Leaving it keeps it pending in the room (restored on return, §5);
 * only Skip forfeits it.
 */
export function isUnfinishedPuzzleStatus(
  status: ChessPuzzlePlayStatus | 'loading'
): boolean {
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.wrong
  );
}

/** Next is offered once the attempt is over (or the puzzle cannot be played). */
export function isFinishedPuzzleStatus(
  status: ChessPuzzlePlayStatus | 'loading'
): boolean {
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solved ||
    status === CHESS_PUZZLE_PLAY_STATUS.revealed ||
    status === CHESS_PUZZLE_PLAY_STATUS.skipped ||
    status === CHESS_PUZZLE_PLAY_STATUS.invalid
  );
}

type HandlersArgs = {
  puzzleId: Accessor<string>;
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  hintStage: Accessor<HintStage>;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
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
      dispatch(RequestChessPuzzleHint({}));
      void args.appendUsedHint();
      return;
    }
    if (hintStage === 'highlight') {
      dispatch(RevealChessPuzzleSolution({}));
      return;
    }
    // Already arrowed: the last step of the same button is §6 "Show solution".
    dispatch(ShowChessPuzzleSolution({}));
  };

  /** §6 "Show solution": the room plays the rest of the line out, then review. */
  const onSolution = (): void => {
    dispatch(ShowChessPuzzleSolution({}));
  };

  return { onHint, onSolution };
}

export function usePuzzlePlayerHandlers(args: HandlersArgs): {
  onMove: (m: Move) => void;
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
  const { onHint, onSolution } = useHintSolutionHandlers({
    hintStage: args.hintStage,
    appendUsedHint: args.appendUsedHint,
  });

  const onMove = (m: Move): void => {
    args.setLastUci(formatUci(m));
    args.onMoveRaw(m);
  };

  /** An unfinished attempt stays pending in the room; a finished one is cleared. */
  const backToRoot = (): void => {
    if (!isUnfinishedPuzzleStatus(args.status())) {
      dispatch(ClearChessPuzzlePlay({}));
    }
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };

  const onRetry = (): void => {
    dispatch(ResetChessPuzzlePlay({}));
  };

  /** Skip is a terminal forfeit; the recorder finalizes it from `skipped`. */
  const onSkip = (): void => {
    if (!isUnfinishedPuzzleStatus(args.status())) return;
    dispatch(SkipChessPuzzlePlay({}));
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
    dispatch(ClearChessPuzzlePlay({}));
    args.onRequestNext();
  };

  const onBack = (): void => {
    dispatch(StepBackChessPuzzlePlay({}));
  };

  const onForward = (): void => {
    dispatch(StepForwardChessPuzzlePlay({}));
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
