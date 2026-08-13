import type { FlatFrame } from './frames';
import type { PlayMode, PlaySpeed } from './router';

/** Hold duration before advancing during playback (matches usePlayback). */
export function playbackHoldMs(args: {
  readonly frame: FlatFrame;
  readonly mode: PlayMode;
  readonly speed: PlaySpeed;
}): number {
  const { frame, mode, speed } = args;
  const base =
    mode === 'fixed'
      ? 250
      : Math.max(40, frame.durationMs > 0 ? frame.durationMs : 120);
  return base / speed;
}
