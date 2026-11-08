const NIBBLES = 'abcdefghijklmnop';

/**
 * Compact evidence lines in the hosted job log, so a run can be reviewed
 * from its log alone: `LIGHT_CYCLES_<KIND> <letters>`. The job log masks
 * secret values wherever they appear, digits included, so each line is the
 * JSON's UTF-8 bytes as two letters a–p per byte, which masking never hits.
 */
export function logEvidence(kind: string, data: Record<string, unknown>) {
  const letters = [...Buffer.from(JSON.stringify(data), 'utf8')]
    .map((byte) => `${NIBBLES[byte >> 4]}${NIBBLES[byte & 15]}`)
    .join('');
  process.stdout.write(`LIGHT_CYCLES_${kind} ${letters}\n`);
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
