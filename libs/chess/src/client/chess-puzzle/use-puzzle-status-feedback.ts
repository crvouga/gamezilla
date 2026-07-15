import {
  CHESS_PUZZLE_PLAY_STATUS,
  type ChessPuzzlePlayStatus,
} from '../../shared/chess-puzzle-play';
import { useEffect, useRef } from 'react';

type PuzzleFeedback = {
  onWrongMove: () => void;
  onSolved: () => void;
};

export function usePuzzleStatusFeedback(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  feedback: PuzzleFeedback;
}): void {
  const { puzzleId, status, feedback } = args;
  const prevStatusRef = useRef<ChessPuzzlePlayStatus | 'loading' | null>(null);

  useEffect(() => {
    prevStatusRef.current = null;
  }, [puzzleId]);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev === status) return;
    if (status === CHESS_PUZZLE_PLAY_STATUS.wrong) {
      feedback.onWrongMove();
    }
    if (status === CHESS_PUZZLE_PLAY_STATUS.solved) {
      feedback.onSolved();
    }
  }, [feedback, status]);
}
