import { useCallback, useEffect, useRef } from 'react';
import { CHESS_PIECE_MOVE_MS } from './chess-board-piece';
import {
  schedulePrimaryMoveSound,
  type PostMoveAudio,
} from './chess-board-schedule-move-sound';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move } from './chess-board-types';

export function useChessBoardApplyMoveSound(sounds: ChessBoardSounds) {
  const delayedPrimarySoundRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(
    () => () => {
      if (delayedPrimarySoundRef.current) {
        clearTimeout(delayedPrimarySoundRef.current);
        delayedPrimarySoundRef.current = null;
      }
    },
    []
  );

  return useCallback(
    (move: Move, post: PostMoveAudio) => {
      if (delayedPrimarySoundRef.current) {
        clearTimeout(delayedPrimarySoundRef.current);
        delayedPrimarySoundRef.current = null;
      }
      const captureDelayMs = move.captured ? CHESS_PIECE_MOVE_MS : 0;
      schedulePrimaryMoveSound(sounds, move, captureDelayMs, (timer) => {
        if (delayedPrimarySoundRef.current) {
          clearTimeout(delayedPrimarySoundRef.current);
        }
        delayedPrimarySoundRef.current = timer;
      });
      if (post.inCheck) {
        sounds.playCheck();
      }
      if (post.isGameOver) {
        sounds.playGameEnd();
      }
    },
    [sounds]
  );
}
