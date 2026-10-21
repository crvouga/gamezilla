import { expect, test } from 'bun:test';
import { postQueryBatch } from '@pkgs/sync-engine-client/post-query-batch';
import {
  MAX_QUERY_BATCH,
  MAX_QUERY_BODY_BYTES,
  type QueryRequestItem,
} from '@pkgs/sync-engine-shared/v2';

async function sentBatches(requests: readonly QueryRequestItem[]) {
  const batches: number[] = [];
  const responses = await postQueryBatch(async (chunk) => {
    const body = JSON.stringify({ queries: chunk });
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(
      MAX_QUERY_BODY_BYTES
    );
    batches.push(chunk.length);
    return chunk.map(() => ({ status: 'not_modified' as const }));
  }, requests);
  expect(responses).toHaveLength(requests.length);
  return batches;
}

test('a sweep is sent in batches of at most the protocol count', async () => {
  const requests = Array.from({ length: MAX_QUERY_BATCH * 2 + 2 }, (_, i) => ({
    name: 'notes',
    params: { i },
  }));
  expect(await sentBatches(requests)).toEqual([
    MAX_QUERY_BATCH,
    MAX_QUERY_BATCH,
    2,
  ]);
});

test('a sweep whose queries outgrow the byte cap is sent in more batches', async () => {
  const third = Math.floor(MAX_QUERY_BODY_BYTES / 3);
  const requests = Array.from({ length: 3 }, (_, i) => ({
    name: 'search',
    params: { i, text: 'x'.repeat(third) },
  }));
  expect(await sentBatches(requests)).toEqual([2, 1]);
});
