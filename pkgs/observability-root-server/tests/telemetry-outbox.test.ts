import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { TelemetryOutbox } from '@pkgs/observability-runtime-shared/telemetry-outbox';

function setup() {
  const time = createHarnessClock();
  const store = new ObjectStoreImplInMemory();
  let nextId = 0;
  let status = 503;
  let acknowledgement = '{}';
  const sent: string[] = [];
  const options = {
    ...time,
    store,
    createId: () => String(++nextId),
    endpoints: {
      traces: 'https://app.test/traces',
      logs: 'https://app.test/logs',
    },
    http: {
      async fetch(_input: RequestInfo | URL, init?: RequestInit) {
        sent.push(String(init?.body));
        return new Response(acknowledgement, { status });
      },
    },
  };
  return {
    options,
    sent,
    store,
    accept: () => {
      status = 200;
    },
    rejectRecords: () => {
      status = 200;
      acknowledgement = '{"partialSuccess":{"rejectedSpans":"1"}}';
    },
  };
}

// regression: browser-diagnostics-lost-during-outage
test('browser evidence survives an outage and reopening before remote delivery', async () => {
  const s = setup();
  const original = new TelemetryOutbox(s.options);
  const body = '{"resourceSpans":[{"literal":"room socket closed 1011"}]}';
  const response = await original.http.fetch(s.options.endpoints.traces, {
    method: 'POST',
    body,
  });
  expect(response.ok).toBe(true);
  await expect(original.flush()).rejects.toThrow('rejected');
  expect(await s.store.listKeys()).toHaveLength(1);
  original.stop();
  const reopened = new TelemetryOutbox(s.options);
  s.accept();
  await reopened.flush();
  expect(s.sent.at(-1)).toBe(body);
  expect(await s.store.listKeys()).toHaveLength(0);
  reopened.stop();
});

test('a partial remote acknowledgement retains the complete batch', async () => {
  const s = setup();
  s.rejectRecords();
  const outbox = new TelemetryOutbox(s.options);
  await outbox.http.fetch(s.options.endpoints.traces, {
    method: 'POST',
    body: '{}',
  });
  await expect(outbox.flush()).rejects.toThrow('records rejected');
  expect(await s.store.listKeys()).toHaveLength(1);
  outbox.stop();
});

test('a stalled upload expires on virtual time and preserves evidence', async () => {
  const s = setup();
  const outbox = new TelemetryOutbox({
    ...s.options,
    http: { fetch: () => new Promise<Response>(() => {}) },
  });
  await outbox.http.fetch(s.options.endpoints.logs, {
    method: 'POST',
    body: '{}',
  });
  const pending = outbox.flush();
  // Allow the local object read to reach the injected HTTP transport.
  for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  s.options.clock.advance(5000);
  await expect(pending).rejects.toThrow('timed out');
  expect(await s.store.listKeys()).toHaveLength(1);
  outbox.stop();
});

test('routine browser evidence expires after thirty days without uploading', async () => {
  const s = setup();
  const original = new TelemetryOutbox(s.options);
  await original.http.fetch(s.options.endpoints.logs, {
    method: 'POST',
    body: '{}',
  });
  await expect(original.flush()).rejects.toThrow('rejected');
  original.stop();
  s.options.clock.advance(30 * 24 * 60 * 60 * 1000);
  s.accept();
  s.sent.length = 0;
  const reopened = new TelemetryOutbox(s.options);
  await reopened.flush();
  expect(s.sent).toHaveLength(0);
  expect(await s.store.listKeys()).toHaveLength(0);
  reopened.stop();
});
