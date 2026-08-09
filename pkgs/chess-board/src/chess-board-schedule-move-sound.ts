import type { Timers } from '@pkgs/clock';

import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move } from './chess-board-types';

export type PostMoveAudio = {
  inCheck: boolean;
  isGameOver: boolean;
};

/** Gap between capture and promote when both apply — never same tick. */
export const PROMOTE_AFTER_CAPTURE_MS = 120;
/** Delay before check/game-end so they never stack with the primary SFX. */
export const CHECK_AFTER_PRIMARY_MS = 160;
export const GAME_END_AFTER_CHECK_MS = 220;

export type DelayedSoundRegistrar = (timer: unknown) => void;

/**
 * Schedules the primary move sound (move / capture / castle / promote).
 * Capture delay is optional (0 when animations are off / instant snap).
 * Promo+capture never fire in the same tick.
 */
export function schedulePrimaryMoveSound(args: {
  readonly sounds: ChessBoardSounds;
  readonly move: Move;
  readonly captureDelayMs: number;
  readonly registerDelayed: DelayedSoundRegistrar;
  readonly timers: Timers;
}): number {
  const { sounds, move, captureDelayMs, registerDelayed, timers } = args;
  const defer = (fn: () => void, ms: number) => {
    if (ms > 0) {
      registerDelayed(
        timers.setTimeout(() => {
          fn();
        }, ms)
      );
      return ms;
    }
    fn();
    return 0;
  };

  if (move.promotion) {
    if (move.captured) {
      defer(() => {
        sounds.playCapture();
        registerDelayed(
          timers.setTimeout(() => {
            sounds.playPromote();
          }, PROMOTE_AFTER_CAPTURE_MS)
        );
      }, captureDelayMs);
      // Follow-ups wait until the last primary (promote) would start.
      return captureDelayMs + PROMOTE_AFTER_CAPTURE_MS;
    }
    sounds.playPromote();
    return 0;
  }
  if (move.castle) {
    sounds.playCastle();
    return 0;
  }
  if (move.captured) {
    return defer(() => sounds.playCapture(), captureDelayMs);
  }
  sounds.playMove();
  return 0;
}
