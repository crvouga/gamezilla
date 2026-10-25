import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createBunRoomHost } from '@pkgs/room-adapter-bun-server-ts/bun-room-host';
import {
  AddOne,
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness-ts/game-room';
import type { RoomServiceReceipt } from '@pkgs/room-root-shared-ts/room-service';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';

// regression: localhost-room-service-upgrade
test('private service commands use the same authoritative room as sockets and deduplicate delivery', async () => {
  // regression: room-host-service-tests-stale-send-status
  const { clock, timers } = createHarnessClock();
  let id = 0;
  const wakes: Promise<void>[] = [];
  const host = createBunRoomHost({
    modules: [gameRoomModule],
    clock,
    timers,
    createId: () => `connection-${++id}`,
    enqueueWake: (_topic, work) => {
      wakes.push(work());
    },
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
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await call(input);
      expect(response.status).toBe(200);
      const receipt = (await response.json()) as RoomServiceReceipt;
      expect(receipt.ok).toBe(true);
      if (!receipt.ok) throw new Error('The private room command was refused');
      expect(readTally(receipt.state)).toBe(1);
    }
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
    await Promise.all(wakes);
    host.dispose();
  }
});
