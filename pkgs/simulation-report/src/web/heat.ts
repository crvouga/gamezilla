export type HeatStyle = {
  readonly cssColor: string;
  readonly t: number;
};

/** Durations at or below this are flat cool green (no relative ramp). */
export const HEAT_COOL_MS = 100;
/** Heat begins leaving cool / entering amber around here. */
export const HEAT_WARM_MS = 1000;
/** At or above this, heat is fully hot / red. */
export const HEAT_HOT_MS = 3000;

/**
 * Absolute green → amber → red heat from wall duration.
 * Sub-100ms stays cool green; warm by ~1s; hot by a few seconds — not
 * relative to other frames in the suite.
 */
export function durationHeat(durationMs: number): HeatStyle {
  const t = absoluteHeatT(durationMs);
  // 140° green → 0° red
  const hue = 140 * (1 - t);
  const sat = 65 + t * 20;
  const lit = 38 + t * 8;
  return {
    t,
    cssColor: `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${lit.toFixed(0)}%)`,
  };
}

function absoluteHeatT(durationMs: number): number {
  const ms = Math.max(0, durationMs);
  if (ms <= HEAT_COOL_MS) {
    // Flat cool — 0ms and 13ms look the same green.
    return 0;
  }
  if (ms <= HEAT_WARM_MS) {
    // 100ms..1s → 0..0.55 (cool into amber)
    return ((ms - HEAT_COOL_MS) / (HEAT_WARM_MS - HEAT_COOL_MS)) * 0.55;
  }
  // 1s..3s → 0.55..1 (warm to hot); clamp above
  return (
    0.55 + Math.min(1, (ms - HEAT_WARM_MS) / (HEAT_HOT_MS - HEAT_WARM_MS)) * 0.45
  );
}
