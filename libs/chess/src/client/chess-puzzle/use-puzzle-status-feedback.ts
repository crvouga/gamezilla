import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import { useEffect, useRef, useState } from 'react';

type PuzzleFeedback = {
  onWrongMove: () => void;
  onSolved: () => void;
};

export function usePuzzleStatusFeedback(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  feedback: PuzzleFeedback;
}): number {
  const { puzzleId, status, feedback } = args;
  const prevStatusRef = useRef<ChessPuzzlePlayStatus | 'loading' | null>(null);
  const [boardShakeNonce, setBoardShakeNonce] = useState(0);

  useEffect(() => {
    prevStatusRef.current = null;
    setBoardShakeNonce(0);
  }, [puzzleId]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status) return;
    if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
      feedback.onWrongMove();
      setBoardShakeNonce((n) => n + 1);
    }
    if (status === CHESS_PUZZLE_PLAY_STATUS.solved) {
      feedback.onSolved();
    }
  }, [feedback, status]);

  return boardShakeNonce;
}
