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
