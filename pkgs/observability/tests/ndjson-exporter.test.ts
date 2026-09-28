import { expect, test } from 'bun:test';
import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';
import {
  createNodeTelemetry,
  NdjsonSpanExporter,
} from '@pkgs/observability/node';
import { NdjsonTraceStore } from '@pkgs/observability/query';

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
