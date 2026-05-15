import { useSpaceRoomDispatch } from '@gamezilla/spaces/client/room/use-space-room-selector';
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

export function usePuzzlePlayerHandlers(args: {
  status: ChessPuzzlePlayStatus | 'loading';
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

  const onHint = useCallback(() => {
    dispatch(RequestChessPuzzleHint({}));
    void appendUsedHint();
  }, [appendUsedHint, dispatch]);

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
