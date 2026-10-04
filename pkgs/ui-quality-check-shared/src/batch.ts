import type { BatchQualityResult, QualityResult } from './ui-quality-check-types';

export async function mapBounded<T, R>(
  inputs: readonly T[],
  concurrency: number,
  run: (input: T, index: number) => Promise<R>
): Promise<readonly R[]> {
  const results: R[] = new Array(inputs.length);
  let cursor = 0;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const index = cursor++;
      if (index >= inputs.length) return;
      const input = inputs[index];
      if (input === undefined) continue;
      try {
        results[index] = await run(input, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, inputs.length) }, worker)
  );
  const error = workers.find((w) => w.status === 'rejected');
  if (error?.status === 'rejected') throw error.reason;
  return results;
}

export function batchResult(
  results: readonly QualityResult[]
): BatchQualityResult {
  const failed = results.filter((r) => !r.pass);
  return {
    schemaVersion: 1,
    pass: failed.length === 0,
    results,
    summary: failed.length
      ? `${failed.length} of ${results.length} inputs failed UI quality.\n${failed.map((r) => r.summary).join('\n')}`
      : `UI quality check passed: ${results.length} inputs, ${results.reduce((n, r) => n + r.framesAnalyzed, 0)} unique frames analyzed.`,
  };
}
