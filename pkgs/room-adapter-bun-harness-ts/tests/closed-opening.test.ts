import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createBunRoomHost } from '@pkgs/room-adapter-bun-server-ts/bun-room-host';
import { gameRoomModule } from '@pkgs/room-root-harness-ts/game-room';
import { parseServerToClientWire } from '@pkgs/room-root-shared-ts/wire';

test('closing sixty-four opening sockets does not exhaust the roster', async () => {
  // regression: room-open-after-close-roster
  const { clock, timers } = createHarnessClock();
  let id = 0;
  const host = createBunRoomHost({
    modules: [gameRoomModule],
    clock,
    timers,
    createId: () => `socket-${++id}`,
    enqueueWake: (_topic, work) => {
      void work();
    },
  });
  const accept = (clientId: string) => {
    const data = host.accept({
      topic: 'literal-room',
      moduleName: gameRoomModule.name,
      actorId: 'alice',
      clientId,
    });
    if (data === null) throw new Error('connection refused');
    return data;
  };
  try {
    for (let index = 0; index < 64; index++) {
      const data = accept(`closed-${index}`);
      const opening = host.open(
        data,
        () => {},
        () => {}
      );
      host.close(data);
      await opening;
    }
    const frames: string[] = [];
    await host.open(
      accept('live'),
      (frame) => frames.push(frame),
      () => {}
    );
    const roster = frames
      .map((frame) => parseServerToClientWire(JSON.parse(frame)))
      .find((frame) => frame?.kind === 'roster');
    expect(roster?.kind === 'roster' ? roster.clients : undefined).toEqual([
      { id: 'alice', clientId: 'live' },
    ]);
  } finally {
    host.dispose();
  }
});
