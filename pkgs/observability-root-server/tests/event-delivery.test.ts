import { expect, test } from 'bun:test';
import {
  InMemoryLogRecordExporter,
  type LogRecordExporter,
} from '@opentelemetry/sdk-logs';
import { createEventDelivery } from '@pkgs/observability-root-server/event-delivery';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import { createEventOutbox } from '@pkgs/observability-root-shared/event-outbox';

const contract = defineEvent({
  name: 'example.game.completed',
  version: 1,
  owner: 'example',
  description: 'A completed game.',
  delivery: 'reliable',
  attributes: { 'game.id': { type: 'string', required: true } },
});
const outbox = createEventOutbox(contract);
const pending = {
  envelope: { id: 'game-1', occurredAtMs: 1234, synthetic: false },
  attributes: { 'game.id': 'game-1' },
  traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
};
const ctx = {
  tx: {
    query: async () => [],
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
  },
  clock: { now: () => 2000 },
  createId: () => 'id-1',
};

// regression: otel-outbox-global-propagator
test('reliable delivery waits for acknowledgement and preserves identity across redelivery', async () => {
  const stored = new InMemoryLogRecordExporter();
  const acknowledgements: Array<() => void> = [];
  const exporter: LogRecordExporter = {
    export(records, callback) {
      acknowledgements.push(() => stored.export(records, callback));
    },
    forceFlush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
  const consumer = createEventDelivery({
    contract,
    message: outbox.message,
    exporter,
    resourceAttributes: {
      'service.name': 'example',
      'deployment.environment.name': 'test',
    },
  });
  let finished = false;
  const first = consumer.handler(ctx, pending).then(() => {
    finished = true;
  });
  // The SDK enters the exporter asynchronously. Microtasks are deterministic.
  for (let i = 0; i < 10 && acknowledgements.length === 0; i++)
    await Promise.resolve();
  expect(finished).toBe(false);
  expect(acknowledgements).toHaveLength(1);
  acknowledgements.shift()?.();
  await first;
  const second = consumer.handler(ctx, pending);
  for (let i = 0; i < 10 && acknowledgements.length === 0; i++)
    await Promise.resolve();
  acknowledgements.shift()?.();
  await second;
  const records = stored.getFinishedLogRecords();
  expect(records).toHaveLength(2);
  expect(new Set(records.map((r) => r.attributes['event.id'])).size).toBe(1);
  expect(records[0]?.hrTime).toEqual([1, 234_000_000]);
  expect(records[0]?.hrTimeObserved).toEqual([2, 0]);
  expect(records[0]?.spanContext?.traceId).toBe(
    '0123456789abcdef0123456789abcdef'
  );
});

test('failed and throwing exporters reject delivery so the existing outbox can retry', async () => {
  for (const throws of [false, true]) {
    const exporter: LogRecordExporter = {
      export(_records, callback) {
        if (throws) throw new Error('transport failed');
        callback({ code: 1 });
      },
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
    const consumer = createEventDelivery({
      contract,
      message: outbox.message,
      exporter,
      resourceAttributes: {},
    });
    await expect(consumer.handler(ctx, pending)).rejects.toThrow(
      'Telemetry export failed'
    );
  }
});

test('invalid payloads never reach the exporter', async () => {
  const exporter = new InMemoryLogRecordExporter();
  const consumer = createEventDelivery({
    contract,
    message: outbox.message,
    exporter,
    resourceAttributes: {},
  });
  await expect(
    consumer.handler(ctx, { ...pending, attributes: { password: 'secret' } })
  ).rejects.toThrow('contract');
  expect(exporter.getFinishedLogRecords()).toHaveLength(0);
  expect(
    outbox.message.validatePayload({
      ...pending,
      envelope: { ...pending.envelope, id: 'person@example.com' },
    })
  ).toBe(false);
});
