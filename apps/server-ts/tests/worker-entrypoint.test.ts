import { expect, test } from 'bun:test';
import * as worker from '@apps/server-ts/worker';

// regression: server-entrypoint-missing-room-durable-object
test('the Worker entrypoint exports its bound Durable Object class', () => {
  expect(worker.RoomServerDurableObject).toBeFunction();
});

// regression: metric-series-multiply-by-worker-isolate
test('the Worker entrypoint exports the single metrics writer it binds', () => {
  expect(worker.MetricAggregateDurableObject).toBeFunction();
});
