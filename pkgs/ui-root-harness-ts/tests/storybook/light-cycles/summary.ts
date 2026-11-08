/**
 * Compact evidence lines in the hosted job log, one JSON object each, so a
 * run can be reviewed from its log alone: `LIGHT_CYCLES_<KIND> {...}`.
 */
export function logEvidence(kind: string, data: Record<string, unknown>) {
  process.stdout.write(`LIGHT_CYCLES_${kind} ${JSON.stringify(data)}\n`);
}

/** Nearest-rank percentile, rounded to 0.1 ms; `null` for no samples. */
export function percentile(values: readonly number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const value =
    sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
  return Math.round((value ?? 0) * 10) / 10;
}

/** Count, longest and total of long tasks, rounded. */
export function longTasks(durations: readonly number[]) {
  return {
    count: durations.length,
    maxMs: Math.round(Math.max(0, ...durations)),
    totalMs: Math.round(durations.reduce((sum, ms) => sum + ms, 0)),
  };
}
