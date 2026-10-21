import { expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared-ts/ndjson';

// regression: local-diagnostic-journal-overflows-argument-limit
test('the accumulated 917125-record journal remains searchable', async () => {
  const record = JSON.stringify({
    traceId: '11111111111111111111111111111111',
    spanId: '2222222222222222',
    name: 'runtime.error',
    startTimeMs: 1000,
    durationMs: 0,
    status: 'error',
    attributes: {},
  });
  const store = new ObjectStoreImplInMemory();
  await store.put(
    'spans.ndjson',
    new TextEncoder().encode(`${record}\n`.repeat(917125)),
    'application/x-ndjson'
  );
  const traces = new NdjsonTraceStore(store);
  expect(await traces.recent({ startMs: 0, endMs: 2000 })).toMatchObject([
    { spanCount: 1, errorCount: 1, rootName: 'runtime.error' },
  ]);
});
