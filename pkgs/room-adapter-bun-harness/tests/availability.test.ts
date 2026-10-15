import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createBunRoomHost } from '@pkgs/room-adapter-bun-server/bun-room-host';
import {
  gameRoomModule,
  readClocksPaused,
  readTimeLeftSeconds,
  StartMatch,
} from '@pkgs/room-root-harness/game-room';
import type { RoomState } from '@pkgs/room-root-shared/types';

// regression: room-clock-charges-shared-outage
test('the private host boundary pauses and resumes the retained match clock', async () => {
  const { clock, timers } = createHarnessClock();
  let id = 0;
  const wakes: Promise<void>[] = [];
  const host = createBunRoomHost({
    modules: [gameRoomModule],
    clock,
    timers,
    createId: () => `room-${++id}`,
    enqueueWake: (_topic, work) => {
      wakes.push(work());
    },
  });
  const call = (input: object) =>
    host.service(
      'game-room:clock',
      gameRoomModule.name,
      new Request('https://room-service/room-service', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    );
  const read = async () =>
    (await (await call({ operation: 'read' })).json()) as RoomState;
  try {
    expect(
      (
        await call({
          operation: 'send',
          commandId: 'start-before-outage',
          payload: StartMatch({ whiteMs: 4000, blackMs: 4000 }),
        })
      ).status
    ).toBe(204);
    expect(
      (await call({ operation: 'availability', available: false })).status
    ).toBe(204);
    clock.advance(2000);
    expect(readClocksPaused(await read())).toBe(true);
    expect(readTimeLeftSeconds(await read(), 'white', clock.now())).toBe(4);
    expect(
      (await call({ operation: 'availability', available: true })).status
    ).toBe(204);
    clock.advance(1000);
    expect(readClocksPaused(await read())).toBe(false);
    expect(readTimeLeftSeconds(await read(), 'white', clock.now())).toBe(3);
  } finally {
    await Promise.all(wakes);
    host.dispose();
  }
});
