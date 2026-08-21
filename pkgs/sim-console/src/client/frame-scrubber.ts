/** Scrubber visual/snap mode. Discrete shows a tick per state. */
export type ScrubMode = 'discrete' | 'continuous';

/** Map a horizontal pointer position on a scrub track to a frame index. */
export function frameIndexFromX(args: {
  readonly x: number;
  readonly width: number;
  readonly frameCount: number;
}): number {
  const { x, width, frameCount } = args;
  if (frameCount <= 1) return 0;
  if (width <= 0) return 0;
  const t = Math.min(1, Math.max(0, x / width));
  return Math.round(t * (frameCount - 1));
}

/** Thumb center as a fraction of track width for `selectedIndex`. */
export function scrubThumbFraction(args: {
  readonly selectedIndex: number;
  readonly frameCount: number;
}): number {
  const { selectedIndex, frameCount } = args;
  if (frameCount <= 1) return 0;
  const max = frameCount - 1;
  return Math.min(1, Math.max(0, selectedIndex / max));
}

/**
 * Tick stop fractions along the track for discrete mode (one per state).
 * Empty when `frameCount` is 0; a single `0` stop when there is one frame.
 */
export function scrubTickFractions(frameCount: number): readonly number[] {
  if (frameCount <= 0) return [];
  if (frameCount === 1) return [0];
  const max = frameCount - 1;
  const ticks: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    ticks.push(i / max);
  }
  return ticks;
}
