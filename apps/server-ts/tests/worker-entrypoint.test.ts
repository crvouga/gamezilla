import { expect, test } from 'bun:test';
import * as worker from '@apps/server-ts/worker';

// regression: server-entrypoint-missing-room-durable-object
test('the Worker entrypoint exports its bound Durable Object class', () => {
  expect(worker.RoomServerDurableObject).toBeFunction();
});
