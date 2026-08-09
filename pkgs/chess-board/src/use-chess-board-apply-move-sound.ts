import { useTimers } from '@pkgs/clock';
import { useCallback, useEffect, useRef } from 'react';
import { CHESS_PIECE_MOVE_MS } from './chess-board-piece';
import {
  CHECK_AFTER_PRIMARY_MS,
  GAME_END_AFTER_CHECK_MS,
  type PostMoveAudio,
  schedulePrimaryMoveSound,
} from './chess-board-schedule-move-sound';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move } from './chess-board-types';

/**
 * Applies move audio without stacking: clears all pending timers, plays one
 * primary sound, then optionally schedules check and game-end after gaps.
 * Capture SFX is deferred to match the piece slide when animations are on.
 */
export function useChessBoardApplyMoveSound(
  sounds: ChessBoardSounds,
  animations: boolean
) {
  const timers = useTimers();
  const timersRef = useRef<unknown[]>([]);

  const clearAllTimers = useCallback(() => {
    for (const t of timersRef.current) timers.clearTimeout(t);
    timersRef.current = [];
  }, [timers]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const registerDelayed = useCallback((timer: unknown) => {
    timersRef.current.push(timer);
  }, []);

  return useCallback(
    (move: Move, post: PostMoveAudio) => {
      clearAllTimers();
      const captureDelayMs =
        animations && move.captured ? CHESS_PIECE_MOVE_MS : 0;
      const primaryOffsetMs = schedulePrimaryMoveSound(
        sounds,
        move,
        captureDelayMs,
        registerDelayed,
        timers
      );
      // Primary may itself defer (capture). Follow-ups start after that delay
      // plus a short gap so they never share a tick with the primary SFX.
      const followUpBase = primaryOffsetMs + CHECK_AFTER_PRIMARY_MS;
      if (post.inCheck) {
        registerDelayed(
          timers.setTimeout(() => {
            sounds.playCheck();
          }, followUpBase)
        );
      }
      if (post.isGameOver) {
        const gameEndAt =
          followUpBase + (post.inCheck ? GAME_END_AFTER_CHECK_MS : 0);
        registerDelayed(
          timers.setTimeout(() => {
            sounds.playGameEnd();
          }, gameEndAt)
        );
      }
    },
    [sounds, clearAllTimers, registerDelayed, animations, timers]
  );
}
