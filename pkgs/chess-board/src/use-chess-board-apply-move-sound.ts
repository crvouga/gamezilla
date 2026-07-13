import { useCallback, useEffect, useRef } from 'react';
import { CHESS_PIECE_MOVE_MS } from './chess-board-piece';
import {
  CHECK_AFTER_PRIMARY_MS,
  GAME_END_AFTER_CHECK_MS,
  schedulePrimaryMoveSound,
  type PostMoveAudio,
} from './chess-board-schedule-move-sound';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move } from './chess-board-types';

/**
 * Applies move audio without stacking: clears all pending timers, plays one
 * primary sound, then optionally schedules check and game-end after gaps.
 */
export function useChessBoardApplyMoveSound(sounds: ChessBoardSounds) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const registerDelayed = useCallback(
    (timer: ReturnType<typeof setTimeout>) => {
      timersRef.current.push(timer);
    },
    []
  );

  return useCallback(
    (move: Move, post: PostMoveAudio) => {
      clearAllTimers();
      const captureDelayMs = move.captured ? CHESS_PIECE_MOVE_MS : 0;
      const primaryOffsetMs = schedulePrimaryMoveSound(
        sounds,
        move,
        captureDelayMs,
        registerDelayed
      );
      // Primary may itself defer (capture). Follow-ups start after that delay
      // plus a short gap so they never share a tick with the primary SFX.
      const followUpBase = primaryOffsetMs + CHECK_AFTER_PRIMARY_MS;
      if (post.inCheck) {
        registerDelayed(
          setTimeout(() => {
            sounds.playCheck();
          }, followUpBase)
        );
      }
      if (post.isGameOver) {
        const gameEndAt =
          followUpBase + (post.inCheck ? GAME_END_AFTER_CHECK_MS : 0);
        registerDelayed(
          setTimeout(() => {
            sounds.playGameEnd();
          }, gameEndAt)
        );
      }
    },
    [sounds, clearAllTimers, registerDelayed]
  );
}
