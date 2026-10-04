import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { RoomState } from '@pkgs/room-shared/types';
import { AddOne, gameRoomModule, readTally } from '@pkgs/room-harness/game-room';
import { createBunRoomHost } from '@pkgs/room-adapter-bun-server/bun-room-host';

// regression: localhost-room-service-upgrade
test('private service commands use the same authoritative room as sockets and deduplicate delivery', async () => {
  const { clock, timers } = createHarnessClock();
  let id = 0;
  const host = createBunRoomHost({
    modules: [gameRoomModule],
    clock,
    timers,
    createId: () => `connection-${++id}`,
  });
  const call = (input: object) =>
    host.service(
      'space:literal',
      gameRoomModule.name,
      new Request('https://room-service/room-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    );
  try {
    const connection = host.accept({
      topic: 'space:literal',
      moduleName: gameRoomModule.name,
      actorId: 'alice',
      clientId: 'phone',
    });
    expect(connection).not.toBeNull();
    const frames: string[] = [];
    if (connection === null) throw new Error('missing connection');
    let closed = false;
    await host.open(
      connection,
      (frame) => frames.push(frame),
      () => {
        closed = true;
      }
    );
    const input = {
      operation: 'send',
      commandId: 'space-membership:f68cf97c-c006-4e9f-84ee-0fa7698180ea',
      payload: AddOne({}),
    };
    expect((await call(input)).status).toBe(204);
    expect((await call(input)).status).toBe(204);
    const state = (await (
      await call({ operation: 'read' })
    ).json()) as RoomState;
    expect(readTally(state)).toBe(1);
    expect(frames.some((frame) => frame.includes('tally-changed'))).toBe(true);
    expect(
      (await call({ operation: 'disconnect', identity: 'alice' })).status
    ).toBe(204);
    expect(closed).toBe(true);
    expect(
      (
        await call({
          operation: 'erase',
          identity: 'alice',
          replacement: 'removed-alice',
        })
      ).status
    ).toBe(204);
  } finally {
    host.dispose();
  }
});
