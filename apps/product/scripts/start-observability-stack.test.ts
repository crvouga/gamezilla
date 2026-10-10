import { expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startObservabilityStack } from './start-observability-stack';

const TRACE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('the native collector stores traces, logs, and metrics as OTLP JSON', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'gz-obs-'));
  const stack = await startObservabilityStack({
    backend: 'native',
    instanceId: 'obs-test',
    dataDir,
  });
  try {
    expect(stack.collectorUrl.endsWith('/v1/traces')).toBe(true);
    expect(stack.logsUrl.endsWith('/v1/logs')).toBe(true);
    expect(stack.metricsUrl.endsWith('/v1/metrics')).toBe(true);
    expect((await post(stack.collectorUrl, traceDocument())).status).toBe(200);
    expect((await post(stack.logsUrl, { resourceLogs: [] })).status).toBe(200);
    expect((await post(stack.metricsUrl, { resourceMetrics: [] })).status).toBe(
      200
    );
    expect((await post(stack.collectorUrl, {})).status).toBe(400);
    const protobuf = await fetch(stack.collectorUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-protobuf' },
      body: 'nope',
    });
    expect(protobuf.status).toBe(415);
    const spans = await readFile(join(dataDir, 'spans.ndjson'), 'utf8');
    expect(spans).toContain('"name":"interaction.timing"');
    expect(spans).toContain(TRACE_ID);
    expect(await readFile(join(dataDir, 'logs.ndjson'), 'utf8')).toContain(
      '"resourceLogs":[]'
    );
    expect(await readFile(join(dataDir, 'metrics.ndjson'), 'utf8')).toContain(
      '"resourceMetrics":[]'
    );
  } finally {
    await stack.stop();
    await rm(dataDir, { recursive: true, force: true });
  }
});

function traceDocument(): unknown {
  return {
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: TRACE_ID,
                spanId: 'bbbbbbbbbbbbbbbb',
                name: 'interaction.timing',
                startTimeUnixNano: '1700000000000000000',
                endTimeUnixNano: '1700000000180000000',
              },
            ],
          },
        ],
      },
    ],
  };
}

function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
