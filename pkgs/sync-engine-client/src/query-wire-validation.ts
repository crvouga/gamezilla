import type { QueryResponse } from '@pkgs/sync-engine-shared/v2';

/** Byzantine / operating: bad wire shape — throw for onError + retry, never assert. */
export function validateWireQueryBatch(
  responses: unknown,
  expectedLength: number
): readonly QueryResponse[] {
  if (!Array.isArray(responses)) {
    throw new Error(
      `query batch response not array: ${typeof responses} for ${expectedLength} requests`
    );
  }
  if (responses.length !== expectedLength) {
    throw new Error(
      `query batch response length mismatch: ${responses.length} responses for ${expectedLength} requests`
    );
  }
  return responses as QueryResponse[];
}
