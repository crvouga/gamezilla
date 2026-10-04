import { expect, test } from 'bun:test';
import * as worker from '@apps/server/worker';

// regression: server-entrypoint-missing-room-durable-object
test('the Worker entrypoint exports its bound Durable Object class', () => {
  expect(worker.RoomServerDurableObject).toBeFunction();
});
