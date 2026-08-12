export type HeatStyle = {
  readonly cssColor: string;
  readonly t: number;
};

/** Green → amber → red heat from duration vs suite max. */
export function durationHeat(durationMs: number, maxMs: number): HeatStyle {
  const max = Math.max(1, maxMs);
  const t = Math.min(1, Math.max(0, durationMs / max));
  // 140° green → 0° red
  const hue = 140 * (1 - t);
  const sat = 65 + t * 20;
  const lit = 38 + t * 8;
  return {
    t,
    cssColor: `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${lit.toFixed(0)}%)`,
  };
}

export function maxFrameDuration(
  frames: readonly { durationMs: number }[]
): number {
  let max = 0;
  for (const f of frames) {
    if (f.durationMs > max) max = f.durationMs;
  }
  return max;
}
