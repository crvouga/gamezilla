import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import { createTimerScheduleStack } from '@pkgs/room';
import {
  gameRoomModule,
  readMatchStatus,
  readWinner,
  StartMatch,
} from '@pkgs/room/harness';
import { RoomServer } from '@pkgs/room/server';
import { DurableObjectRoomStorage } from '@pkgs/room-adapter-durable-object';
import { MemoryKv } from './helpers/memory-kv';

test('an interrupted timeout can finish without a player reconnecting', async () => {
  // regression: room-interrupted-timeout-lost-wake
  const kv = new MemoryKv();
  const { clock, timers } = createHarnessClock({ startMs: 1700000000000 });
  let wake = Promise.resolve();
  let nextId = 0;
  const schedule = createTimerScheduleStack({
    clock,
    timers,
    topic: 'room:timeout',
    createId: () => `wake-${++nextId}`,
    enqueueWake: (work) => {
      wake = wake.then(work, work);
    },
  });
  const server = new RoomServer({
    topic: 'room:timeout',
    module: gameRoomModule,
    storage: new DurableObjectRoomStorage(kv),
    clock,
    effectHandlers: [schedule.handler],
  });
  schedule.bindInject((args) => server.injectCommand(args));
  await server.hydrateFromStorage();
  await server.injectCommand({
    id: 'start',
    identity: 'white',
    payload: StartMatch({ whiteMs: 4000, blackMs: 4000 }),
  });
  kv.interruptAfterEventWrite = true;
  clock.advance(4000);
  await expect(wake).rejects.toThrow('stopped after event write');
  expect(readMatchStatus(server.getCommittedState())).toBe('playing');
  wake = wake.catch(() => undefined);
  clock.advance(0);
  await wake;
  expect(readMatchStatus(server.getCommittedState())).toBe('over');
  expect(readWinner(server.getCommittedState())).toBe('black');
  schedule.dispose();
});
