import { expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock-shared/types';
import { createEventDelivery } from '@pkgs/observability-root-server/event-delivery';
import { defineEvent } from '@pkgs/observability-root-shared/event-contract';
import { createEventOutbox } from '@pkgs/observability-root-shared/event-outbox';
import { AcknowledgedLogExporter } from '@pkgs/observability-runtime-shared/acknowledged-log-exporter';

const contract = defineEvent({
  name: 'example.work.completed',
  owner: 'example',
  version: 1,
  description: 'Work completed.',
  delivery: 'reliable',
  attributes: {},
});
const event = createEventOutbox(contract);
const pending = {
  attributes: {},
  envelope: { id: 'work-1', occurredAtMs: 1000, synthetic: false },
};
const ctx = {
  tx: {
    query: async () => [],
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
  },
  clock: { now: () => 2000 },
  createId: () => 'id-1',
};

function timerPorts() {
  let deadline: (() => void) | undefined;
  const timers: Timers = {
    setTimeout: (fn) => {
      deadline = fn;
      return 'timer-1';
    },
    clearTimeout: () => {
      deadline = undefined;
    },
    setInterval: () => {
      throw new Error('Intervals are not used');
    },
    clearInterval: () => {},
  };
  return {
    timers,
    expire: () => deadline?.(),
    hasDeadline: () => deadline !== undefined,
  };
}

test('partial OTLP rejection fails durable delivery despite HTTP 200', async () => {
  // regression: otel-partial-acknowledgement
  const ports = timerPorts();
  const exporter = new AcknowledgedLogExporter(
    'https://collector.example/v1/logs',
    {},
    {
      fetch: async () =>
        Response.json({ partialSuccess: { rejectedLogRecords: '1' } }),
    },
    ports.timers
  );
  const consumer = createEventDelivery({
    contract,
    message: event.message,
    exporter,
    resourceAttributes: {},
  });
  await expect(consumer.handler(ctx, pending)).rejects.toThrow(
    'Telemetry export failed'
  );
  expect(ports.hasDeadline()).toBe(false);
});

test('acknowledged delivery sends official OTLP JSON and keeps credentials out of the payload', async () => {
  const ports = timerPorts();
  let body = '';
  const exporter = new AcknowledgedLogExporter(
    'https://collector.example/v1/logs',
    { Authorization: 'Bearer fixture-token' },
    {
      async fetch(_input, init) {
        expect(new Headers(init?.headers).get('authorization')).toBe(
          'Bearer fixture-token'
        );
        body = await new Response(init?.body).text();
        return Response.json({});
      },
    },
    ports.timers
  );
  const consumer = createEventDelivery({
    contract,
    message: event.message,
    exporter,
    resourceAttributes: {},
  });
  await consumer.handler(ctx, pending);
  expect(body).toContain('resourceLogs');
  expect(body).toContain('example.work.completed');
  expect(body).not.toContain('fixture-token');
  expect(ports.hasDeadline()).toBe(false);
});

test('an unresponsive transport times out on injected virtual time', async () => {
  const ports = timerPorts();
  const exporter = new AcknowledgedLogExporter(
    'https://collector.example/v1/logs',
    {},
    {
      fetch: () => new Promise<Response>(() => {}),
    },
    ports.timers
  );
  const consumer = createEventDelivery({
    contract,
    message: event.message,
    exporter,
    resourceAttributes: {},
  });
  const delivery = consumer.handler(ctx, pending);
  void delivery.catch(() => {});
  for (let turn = 0; turn < 10 && !ports.hasDeadline(); turn++)
    await Promise.resolve();
  expect(ports.hasDeadline()).toBe(true);
  ports.expire();
  await expect(delivery).rejects.toThrow('Telemetry export failed');
  expect(ports.hasDeadline()).toBe(false);
});
