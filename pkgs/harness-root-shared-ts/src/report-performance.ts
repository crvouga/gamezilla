import type {
  ReportPerformanceOptions,
  ReportPerformanceSummary,
  ReportStep,
  ReportStepPerformance,
} from '@crvouga/atlas/reports/report-types';

export type OpenStepPerformance = {
  readonly options: ReportPerformanceOptions;
  executionMs: number;
  snapshotMs: number;
};

export function openStepPerformance(
  options: ReportPerformanceOptions | undefined
): OpenStepPerformance | null {
  if (options === undefined) return null;
  if (!Number.isFinite(options.slowStepMs) || options.slowStepMs <= 0) {
    throw new Error('performance slowStepMs must be finite and positive');
  }
  return { options, executionMs: 0, snapshotMs: 0 };
}

export async function measureStepWork(
  performance: OpenStepPerformance | null,
  phase: 'executionMs' | 'snapshotMs',
  work: () => Promise<void>
): Promise<void> {
  if (performance === null) return work();
  const start = performance.options.clock.now();
  try {
    await work();
  } finally {
    performance[phase] += Math.max(0, performance.options.clock.now() - start);
  }
}

export function closeStepPerformance(
  open: OpenStepPerformance | null,
  children: readonly ReportStep[]
): ReportStepPerformance | undefined {
  if (open === null) return undefined;
  const nestedMs = children.reduce((sum, child) => {
    const sample = child.performance;
    return (
      sum + (sample === undefined ? 0 : sample.executionMs + sample.snapshotMs)
    );
  }, 0);
  return {
    executionMs: open.executionMs,
    selfMs: Math.max(0, open.executionMs - nestedMs),
    snapshotMs: open.snapshotMs,
  };
}

export function summarizePerformance(
  steps: readonly ReportStep[],
  slowStepMs: number
): ReportPerformanceSummary {
  let executionMs = 0;
  let snapshotMs = 0;
  let measuredSteps = 0;
  let slowSteps = 0;
  const remaining = [...steps];
  while (remaining.length > 0) {
    const step = remaining.pop()!;
    remaining.push(...step.steps);
    const sample = step.performance;
    if (sample === undefined) continue;
    executionMs += sample.selfMs;
    snapshotMs += sample.snapshotMs;
    measuredSteps += 1;
    if (sample.selfMs > slowStepMs) slowSteps += 1;
  }
  return { executionMs, snapshotMs, measuredSteps, slowSteps, slowStepMs };
}
