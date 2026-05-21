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
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import type { Move } from '../chess-board/chess-board-types';
import { uciFromMove } from './chess-puzzle-play-chess-utils';
import type { HintStage } from './use-hint-stage';

export function usePuzzlePlayerHandlers(args: {
  status: ChessPuzzlePlayStatus | 'loading';
  hintStage: HintStage;
  showSolution: () => void;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  onRequestNext: () => void;
}): {
  onMove: (m: Move) => void;
  onHint: () => void;
  onRetry: () => void;
  onNext: () => Promise<void>;
  backToRoot: () => void;
} {
  const {
    status,
    hintStage,
    showSolution,
    onMoveRaw,
    setLastUci,
    appendUsedHint,
    appendAbandoned,
    onRequestNext,
  } = args;
  const dispatch = useSpaceRoomDispatch();

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

  // Two-step reveal: first press fetches the hint and records it; second
  // press promotes the local stage to `'solution'` (handled in the hook).
  const onHint = useCallback(() => {
    if (hintStage === 'none') {
      dispatch(RequestChessPuzzleHint({}));
      void appendUsedHint();
      return;
    }
    if (hintStage === 'highlight') {
      showSolution();
    }
  }, [appendUsedHint, dispatch, hintStage, showSolution]);

  const onRetry = useCallback(() => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) {
      void appendAbandoned();
    }
    dispatch(ResetChessPuzzlePlay({}));
  }, [appendAbandoned, dispatch, status]);

  const onNext = useCallback(async () => {
    if (status !== CHESS_PUZZLE_PLAY_STATUS.solved) {
      await appendAbandoned();
    }
    dispatch(ClearChessPuzzlePlay({}));
    onRequestNext();
  }, [appendAbandoned, dispatch, onRequestNext, status]);

  return { onMove, onHint, onRetry, onNext, backToRoot };
}
