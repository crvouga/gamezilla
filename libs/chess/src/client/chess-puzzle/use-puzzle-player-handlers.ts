import { useSpaceRoomDispatch } from '@libs/spaces/client/room/use-space-room-selector';
import { useCallback } from 'react';
import {
  CHESS_SCREEN,
  SetChessMainMenuScreen,
} from '../../shared/chess-main-menu';
import {
  CHESS_PUZZLE_PLAY_STATUS,
  ClearChessPuzzlePlay,
  RequestChessPuzzleHint,
  ResetChessPuzzlePlay,
  StepBackChessPuzzlePlay,
  StepForwardChessPuzzlePlay,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import type { Move } from '@pkgs/chess-board/chess-board-types';
import { uciFromMove } from './chess-puzzle-play-chess-utils';
import type { HintStage } from './use-hint-stage';

type HandlersArgs = {
  status: ChessPuzzlePlayStatus | 'loading';
  hintStage: HintStage;
  showSolution: () => void;
  requestSolution: () => void;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  onRequestNext: () => void;
};

function useHintSolutionHandlers(
  args: Pick<
    HandlersArgs,
    'hintStage' | 'showSolution' | 'requestSolution' | 'appendUsedHint'
  >
): { onHint: () => void; onSolution: () => void } {
  const dispatch = useSpaceRoomDispatch();
  const { hintStage, showSolution, requestSolution, appendUsedHint } = args;

  const onHint = useCallback(() => {
    if (hintStage === 'none') {
      dispatch(RequestChessPuzzleHint({}));
      void appendUsedHint();
      return;
    }
    if (hintStage === 'highlight') showSolution();
  }, [appendUsedHint, dispatch, hintStage, showSolution]);

  const onSolution = useCallback(() => {
    if (hintStage === 'solution') return;
    if (hintStage === 'none') {
      dispatch(RequestChessPuzzleHint({}));
      void appendUsedHint();
    }
    requestSolution();
  }, [appendUsedHint, dispatch, hintStage, requestSolution]);

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
  const {
    status,
    onMoveRaw,
    setLastUci,
    appendAbandoned,
    onRequestNext,
    hintStage,
    showSolution,
    requestSolution,
    appendUsedHint,
  } = args;
  const dispatch = useSpaceRoomDispatch();
  const { onHint, onSolution } = useHintSolutionHandlers({
    hintStage,
    showSolution,
    requestSolution,
    appendUsedHint,
  });

  const onMove = useCallback(
    (m: Move) => {
      setLastUci(uciFromMove(m));
      onMoveRaw(m);
    },
    [onMoveRaw, setLastUci]
  );

  const backToRoot = useCallback(() => {
    dispatch(ClearChessPuzzlePlay({}));
    dispatch(SetChessMainMenuScreen({ screen: CHESS_SCREEN.root }));
  }, [dispatch]);

  const onRetry = useCallback(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) {
      void appendAbandoned();
    }
    dispatch(ResetChessPuzzlePlay({}));
  }, [appendAbandoned, dispatch, status]);

  const onNext = useCallback((): void => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) {
      void appendAbandoned();
    }
    dispatch(ClearChessPuzzlePlay({}));
    onRequestNext();
  }, [appendAbandoned, dispatch, onRequestNext, status]);

  const onBack = useCallback(() => {
    dispatch(StepBackChessPuzzlePlay({}));
  }, [dispatch]);

  const onForward = useCallback(() => {
    dispatch(StepForwardChessPuzzlePlay({}));
  }, [dispatch]);

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
