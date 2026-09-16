import { useSpaceRoomDispatch } from '@libs/spaces/public/room/use-space-room-selector';
import type { Move } from '@pkgs/chess-board/chess-board-types';
import type { Accessor } from 'solid-js';

import type { HintStage } from '../../shared/puzzle-session/hint-stage';
import { CHESS_SCREEN, SetChessMainMenuScreen } from '../chess-main-menu';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
  ClearChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  RevealChessPuzzleSolution,
  StepBackChessPuzzlePlay,
  StepForwardChessPuzzlePlay,
} from '../chess-puzzle-play';
import { uciFromMove } from './chess-puzzle-play-chess-utils';

/**
 * A rated attempt is in flight only while the player is still moving or has
 * just gone wrong. Solved plays are closed; idle / invalid / loading rooms
 * have nothing to forfeit.
 */
export function isUnfinishedPuzzleStatus(
  status: ChessPuzzlePlayStatus | 'loading'
): boolean {
  return (
    status === CHESS_PUZZLE_PLAY_STATUS.solving ||
    status === CHESS_PUZZLE_PLAY_STATUS.wrong
  );
}

type HandlersArgs = {
  status: Accessor<ChessPuzzlePlayStatus | 'loading'>;
  hintStage: Accessor<HintStage>;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
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
    }
  };

  const onSolution = (): void => {
    const hintStage = args.hintStage();
    if (hintStage === 'solution') return;
    if (hintStage === 'none') {
      void args.appendUsedHint();
    }
    dispatch(RevealChessPuzzleSolution({}));
  };

  return { onHint, onSolution };
}

export function usePuzzlePlayerHandlers(args: HandlersArgs): {
  onMove: (m: Move) => void;
  onHint: () => void;
  onSolution: () => void;
  onRetry: () => void;
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
    args.setLastUci(uciFromMove(m));
    args.onMoveRaw(m);
  };

  /** Leaving an unfinished attempt (Back / Next / Retry) forfeits it. */
  const abandonIfUnfinished = (): void => {
    if (!isUnfinishedPuzzleStatus(args.status())) return;
    void args.appendAbandoned();
  };

  const backToRoot = (): void => {
    abandonIfUnfinished();
    dispatch(ClearChessPuzzlePlay({}));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  };

  const onRetry = (): void => {
    abandonIfUnfinished();
    dispatch(ResetChessPuzzlePlay({}));
  };

  const onNext = (): void => {
    abandonIfUnfinished();
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
    onNext,
    onBack,
    onForward,
    backToRoot,
  };
}
