import { expect, test } from 'bun:test';
import type {
  ObjectStore,
  StoredObject,
} from '@pkgs/object-store-root-shared-ts/interface';
import { createNodeTelemetry } from '@pkgs/observability-root-server-ts/node-node';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared-ts/ndjson';
import {
  NdjsonSpanExporter,
  segmentKey,
} from '@pkgs/observability-runtime-shared-ts/ndjson-exporter';

function memoryStore(): ObjectStore {
  const values = new Map<string, Uint8Array>();
  return {
    async get(key): Promise<StoredObject | null> {
      const bytes = values.get(key);
      return bytes === undefined
        ? null
        : {
            body: new Blob([Uint8Array.from(bytes)]).stream(),
            contentType: 'application/x-ndjson',
            size: bytes.byteLength,
          };
    },
    async put(key, bytes) {
      values.set(key, bytes);
    },
    async head(key) {
      return values.has(key);
    },
    async delete(key) {
      values.delete(key);
    },
    async deleteMany(keys) {
      for (const key of keys) values.delete(key);
    },
    async getUri() {
      return null;
    },
    async listKeys() {
      return [...values.keys()].sort();
    },
    withPrefix() {
      return this;
    },
  };
}

test('node artifact exporter flushes queryable NDJSON', async () => {
  const store = memoryStore();
  const runtime = createNodeTelemetry({
    serviceName: 'spec-fixture',
    serviceVersion: 'sha',
    environment: 'ci',
    buildSha: 'sha',
    exporter: new NdjsonSpanExporter({ store, key: 'spans.ndjson' }),
    registerGlobal: false,
  });
  const span = runtime.provider.getTracer('test').startSpan('test.failure');
  span.setStatus({ code: 2, message: 'fixture failed' });
  span.end();
  await runtime.forceFlush();

  const traces = await new NdjsonTraceStore(store).recent({
    startMs: 0,
    endMs: Number.MAX_SAFE_INTEGER,
  });
  expect(traces).toHaveLength(1);
  expect(traces[0]).toMatchObject({ rootName: 'test.failure', errorCount: 1 });
  await runtime.shutdown();
});

test('node runtime accepts the standard OTel ID generator', async () => {
  const store = memoryStore();
  const runtime = createNodeTelemetry({
    serviceName: 'deterministic-fixture',
    serviceVersion: 'sha',
    environment: 'test',
    buildSha: 'sha',
    exporter: new NdjsonSpanExporter({ store, key: 'spans.ndjson' }),
    idGenerator: {
      generateTraceId: () => '12345678901234567890123456789012',
      generateSpanId: () => '1234567890123456',
    },
    registerGlobal: false,
  });
  runtime.provider.getTracer('test').startSpan('known-id').end();
  await runtime.forceFlush();

  const trace = await new NdjsonTraceStore(store).getTrace(
    '12345678901234567890123456789012'
  );
  expect(trace?.spans[0]?.spanId).toBe('1234567890123456');
  await runtime.shutdown();
});

// regression: span-artifact-rewritten-every-export
test('an export rewrites one bounded segment, not everything recorded so far', async () => {
  const store = memoryStore();
  let written = 0;
  let read = 0;
  const counting: ObjectStore = {
    ...store,
    get: async (key) => {
      const object = await store.get(key);
      read += object?.size ?? 0;
      return object;
    },
    put: async (key, bytes, contentType) => {
      written += bytes.byteLength;
      await store.put(key, bytes, contentType);
    },
  };
  const runtime = createNodeTelemetry({
    serviceName: 'spec-fixture',
    serviceVersion: 'sha',
    environment: 'ci',
    buildSha: 'sha',
    exporter: new NdjsonSpanExporter({
      store: counting,
      key: 'traces/spans.ndjson',
      segmentChars: 2_000,
    }),
    registerGlobal: false,
  });
  const tracer = runtime.provider.getTracer('test');
  const exports = 200;
  for (let index = 0; index < exports; index += 1) {
    tracer.startSpan(`db.query ${String(index)}`).end();
    await runtime.forceFlush();
  }
  await runtime.shutdown();

  const keys = await store.listKeys();
  expect(keys).toContain('traces/spans.ndjson');
  expect(keys).toContain('traces/spans.1.ndjson');
  let stored = 0;
  for (const key of keys) stored += (await store.get(key))?.size ?? 0;
  // One growing object rewrote ~100 times what it held; a segment is
  // rewritten only until it is full.
  expect(written).toBeLessThan(stored * 8);
  expect(read).toBe(0);
  const traces = await new NdjsonTraceStore(store).recent({
    startMs: 0,
    endMs: Number.MAX_SAFE_INTEGER,
  });
  expect(traces).toHaveLength(exports);
});

test('an existing artifact is added to, and segments keep the extension', async () => {
  const store = memoryStore();
  const earlier = '{"earlier":true}\n';
  await store.put(
    'spans.ndjson',
    new TextEncoder().encode(earlier),
    'application/x-ndjson'
  );
  const runtime = createNodeTelemetry({
    serviceName: 'spec-fixture',
    serviceVersion: 'sha',
    environment: 'ci',
    buildSha: 'sha',
    exporter: new NdjsonSpanExporter({ store, key: 'spans.ndjson' }),
    registerGlobal: false,
  });
  runtime.provider.getTracer('test').startSpan('later').end();
  await runtime.forceFlush();
  await runtime.shutdown();
  const text = await new Response(
    (await store.get('spans.ndjson'))!.body
  ).text();
  expect(text.startsWith(earlier)).toBe(true);
  expect(text).toContain('"name":"later"');
  expect(segmentKey('traces/spans.ndjson', 0)).toBe('traces/spans.ndjson');
  expect(segmentKey('traces/spans.ndjson', 3)).toBe('traces/spans.3.ndjson');
  expect(segmentKey('run.1/spans', 2)).toBe('run.1/spans.2');
});
