import { t } from './theme-tokens';

export type HeatStyle = {
  readonly cssColor: string;
  readonly t: number;
};

/** Durations at or below this stay neutral (fast / default). */
export const HEAT_COOL_MS = 100;
/** Heat begins leaving cool / entering amber around here. */
export const HEAT_WARM_MS = 1000;
/** At or above this, heat is fully hot / red. */
export const HEAT_HOT_MS = 3000;

/** Neutral track fill for fast frames. */
export const HEAT_NEUTRAL_COLOR = t.panel2;

/**
 * Slow-only heat: fast frames are neutral; slower frames amber→red.
 * Absolute thresholds — not relative to other frames in the suite.
 */
export function durationHeat(durationMs: number): HeatStyle {
  const heatT = absoluteHeatT(durationMs);
  if (heatT <= 0) {
    return { t: 0, cssColor: HEAT_NEUTRAL_COLOR };
  }
  // 45° amber → 0° red (skip green — green read as "good/default")
  const hue = 45 * (1 - heatT);
  const sat = 70 + heatT * 15;
  const lit = 40 + heatT * 6;
  return {
    t: heatT,
    cssColor: `hsl(${hue.toFixed(1)} ${sat.toFixed(0)}% ${lit.toFixed(0)}%)`,
  };
}

function absoluteHeatT(durationMs: number): number {
  const ms = Math.max(0, durationMs);
  if (ms <= HEAT_COOL_MS) return 0;
  if (ms <= HEAT_WARM_MS) {
    // 100ms..1s → 0..0.55
    return ((ms - HEAT_COOL_MS) / (HEAT_WARM_MS - HEAT_COOL_MS)) * 0.55;
  }
  return (
    0.55 +
    Math.min(1, (ms - HEAT_WARM_MS) / (HEAT_HOT_MS - HEAT_WARM_MS)) * 0.45
  );
}
