import type { ReportStep } from '@pkgs/harness-root-shared/report-types';
import { type FlatFrame, type FlatStep, flattenSteps } from './frames';

export type HeatBand = 'unmeasured' | 'cool' | 'warm' | 'slow';
export type PerformanceRow = FlatStep & {
  readonly band: HeatBand;
};

export function heatBand(
  ms: number | undefined,
  allowanceMs: number
): HeatBand {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return 'unmeasured';
  if (ms > allowanceMs) return 'slow';
  return ms > allowanceMs / 4 ? 'warm' : 'cool';
}

export function performanceRows(
  steps: readonly ReportStep[],
  allowanceMs: number
): PerformanceRow[] {
  return flattenSteps(steps).map((row) => ({
    ...row,
    band: heatBand(row.step.performance?.selfMs, allowanceMs),
  }));
}

/** Self time attributes nested work once, instead of ranking every ancestor as slow. */
export function performanceHotspots(
  rows: readonly PerformanceRow[]
): PerformanceRow[] {
  return rows
    .filter((row) => row.band !== 'unmeasured')
    .sort(
      (a, b) =>
        (b.step.performance?.selfMs ?? 0) - (a.step.performance?.selfMs ?? 0) ||
        a.index - b.index
    );
}

export function measuredMs(ms: number): string {
  return `${ms.toFixed(2)} ms`;
}

/** Linear lookup for a large heatmap; includes a parent's first descendant frame. */
export function performanceFrameIndex(
  rows: readonly PerformanceRow[],
  frames: readonly FlatFrame[]
): ReadonlyMap<ReportStep, FlatFrame> {
  const byStep = new Map<ReportStep, FlatFrame>();
  for (const frame of frames) {
    if (!byStep.has(frame.step)) byStep.set(frame.step, frame);
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const step = rows[i]!.step;
    if (byStep.has(step)) continue;
    for (const child of step.steps) {
      const frame = byStep.get(child);
      if (frame === undefined) continue;
      byStep.set(step, frame);
      break;
    }
  }
  return byStep;
}
