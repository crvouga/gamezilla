import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move } from './chess-board-types';

export type PostMoveAudio = {
  inCheck: boolean;
  isGameOver: boolean;
};

export function schedulePrimaryMoveSound(
  sounds: ChessBoardSounds,
  move: Move,
  captureDelayMs: number,
  registerDelayed: (t: ReturnType<typeof setTimeout>) => void
): void {
  const defer = (fn: () => void) => {
    if (captureDelayMs > 0) {
      registerDelayed(
        setTimeout(() => {
          fn();
        }, captureDelayMs)
      );
    } else {
      fn();
    }
  };

  if (move.promotion) {
    if (move.captured) {
      defer(() => {
        sounds.playCapture();
        sounds.playPromote();
      });
    } else {
      sounds.playPromote();
    }
  } else if (move.castle) {
    sounds.playCastle();
  } else if (move.captured) {
    defer(() => sounds.playCapture());
  } else {
    sounds.playMove();
  }
}
