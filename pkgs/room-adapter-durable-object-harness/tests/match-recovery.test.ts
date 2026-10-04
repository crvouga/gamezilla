import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { DurableObjectRoomStorage } from '@pkgs/room-adapter-durable-object-shared/storage';
import {
  AddOne,
  gameRoomModule,
  Move,
  readMatchStatus,
  readTimeLeftSeconds,
  readWinner,
  StartMatch,
} from '@pkgs/room-root-harness/game-room';
import { RoomServer } from '@pkgs/room-root-server/room-server';
import { createTimerScheduleStack } from '@pkgs/room-root-shared/timer-schedule-stack';
import { MemoryKv } from './memory-kv';

test.each([
  ['start', 2],
  ['start', 4],
  ['start', 9],
  ['move', 2],
  ['move', 4],
  ['move', 9],
] as const)(
  'a persisted %s keeps its deadline after a %s-second outage',
  async (change, outageSeconds) => {
    // regression: room-accepted-match-lost-deadline
    const kv = new MemoryKv();
    const { clock, timers } = createHarnessClock({ startMs: 1700000000000 });
    let queue = Promise.resolve();
    let nextId = 0;
    const open = async () => {
      const schedule = createTimerScheduleStack({
        clock,
        timers,
        topic: 'room:match',
        createId: () => `wake-${++nextId}`,
        enqueueWake: (work) => {
          queue = queue.then(work);
        },
      });
      const server = new RoomServer({
        topic: 'room:match',
        module: gameRoomModule,
        storage: new DurableObjectRoomStorage(kv),
        clock,
        effectHandlers: [schedule.handler],
      });
      schedule.bindInject((args) => server.injectCommand(args));
      await server.hydrateFromStorage();
      return { server, dispose: schedule.dispose };
    };
    const first = await open();
    const start = {
      id: 'start',
      identity: 'white',
      payload: StartMatch({ whiteMs: 4000, blackMs: 4000 }),
    };
    if (change === 'move') await first.server.injectCommand(start);
    kv.interruptAfterTransaction = true;
    await expect(
      first.server.injectCommand(
        change === 'start'
          ? start
          : {
              id: 'move',
              identity: 'white',
              payload: Move({}),
            }
      )
    ).rejects.toThrow('stopped after transaction committed');
    first.dispose();
    clock.advance(outageSeconds * 1000);
    const returned = await open();
    const next = change === 'start' ? 'white' : 'black';
    expect(
      readTimeLeftSeconds(
        returned.server.getCommittedState(),
        next,
        clock.now()
      )
    ).toBe(Math.max(0, 4 - outageSeconds));
    clock.advance(Math.max(0, 4 - outageSeconds) * 1000);
    await queue;
    // A barrier waits for any scheduled authoritative command; no client remains.
    await returned.server.injectCommand({
      id: 'barrier',
      identity: 'observer',
      payload: AddOne({}),
    });
    expect(readMatchStatus(returned.server.getCommittedState())).toBe('over');
    expect(readWinner(returned.server.getCommittedState())).toBe(
      change === 'start' ? 'black' : 'white'
    );
    returned.dispose();
  }
);
