import { createMutationReplayMetric } from '@pkgs/observability-root-shared-ts/mutation-metrics';
import type { ProcessMutationsBatchResult } from './process-mutations-batch';

/**
 * Count what became of each uploaded write once its batch is settled, never
 * per transaction attempt. A batch that loses a serialization race is
 * replayed whole in a fresh transaction (`retryMutationTransaction`), so
 * counting each attempt would call a write the server then saved a failure,
 * and count every write before the race twice. A batch that still throws
 * decided none of its writes: each is `failed` and will be uploaded again.
 */
export async function countMutationReplays<
  T extends { readonly result: ProcessMutationsBatchResult },
>(mutationCount: number, settle: () => Promise<T>): Promise<T> {
  const count = createMutationReplayMetric();
  let settled: T;
  try {
    settled = await settle();
  } catch (error) {
    for (let index = 0; index < mutationCount; index += 1) count('failed');
    throw error;
  }
  const applied = new Set(
    settled.result.applied.map((item) => item.mutationId)
  );
  for (const verdict of settled.result.verdicts) {
    if (verdict.status === 'rejected') count('rejected');
    else count(applied.has(verdict.mutationId) ? 'applied' : 'duplicate');
  }
  return settled;
}
