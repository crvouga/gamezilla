import { expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared-ts/ndjson';

// regression: local-diagnostic-journal-overflows-argument-limit
// regression: local-diagnostic-journal-reparses-identical-records
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

test('journal duplicate reduction retains the last distinct version and the unterminated tail', async () => {
  const first = {
    traceId: '11111111111111111111111111111111',
    spanId: '2222222222222222',
    name: 'first',
    startTimeMs: 1000,
    durationMs: 1,
    status: 'ok',
    attributes: {},
  };
  const changed = { ...first, name: 'changed', durationMs: 2 };
  const tail = { ...first, spanId: '3333333333333333', name: 'tail' };
  const store = new ObjectStoreImplInMemory();
  await store.put(
    'spans.ndjson',
    new TextEncoder().encode(
      [first, first, changed, changed, tail]
        .map((record) => JSON.stringify(record))
        .join('\n')
    ),
    'application/x-ndjson'
  );
  const result = await new NdjsonTraceStore(store).getTrace(first.traceId);
  expect(result?.spans.map((span) => span.name).sort()).toEqual([
    'changed',
    'tail',
  ]);
});
