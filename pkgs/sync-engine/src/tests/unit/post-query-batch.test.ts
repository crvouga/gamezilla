import { describe, expect, test } from 'bun:test';

import { postQueryBatch } from '../../client/post-query-batch';
import type { QueryRequest } from '../../client/subscription-runtime';
import { MAX_QUERY_BATCH } from '../../queries/shared/bounds';

describe('postQueryBatch', () => {
  test('chunks requests over MAX_QUERY_BATCH and preserves order', async () => {
    const requests: QueryRequest[] = [];
    for (let i = 0; i < MAX_QUERY_BATCH + 3; i += 1) {
      requests.push({ name: 'q', params: { i } });
    }
    const chunks: number[] = [];
    const responses = await postQueryBatch(async (chunk) => {
      chunks.push(chunk.length);
      return chunk.map(() => ({ status: 'not_modified' as const }));
    }, requests);
    expect(chunks).toEqual([MAX_QUERY_BATCH, 3]);
    expect(responses).toHaveLength(requests.length);
  });

  test('throws when a chunk response length mismatches', async () => {
    await expect(
      postQueryBatch(
        async () => [{ status: 'not_modified' }],
        [
          { name: 'a', params: {} },
          { name: 'b', params: {} },
        ]
      )
    ).rejects.toThrow(/query batch response length mismatch/i);
  });
});
