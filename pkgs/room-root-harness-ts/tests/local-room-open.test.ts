import { expect, test } from 'bun:test';
import { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import {
  AddOne,
  gameRoomModule,
  readTally,
} from '@pkgs/room-root-harness-ts/game-room';
import { FakeTransport } from './fake-transport';
import { CountingClientStorage } from './memory-storage';
import { testPorts } from './ports';

// regression: room-local-open-waits-for-connection
test('local room commands are available while admission is pending', async () => {
  const transport = new FakeTransport();
  let release: (() => void) | undefined;
  transport.connect = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const ports = testPorts();
  let opened = false;
  const opening = RoomClient.open({
    topic: 'local-room',
    module: gameRoomModule,
    storage: new CountingClientStorage(),
    transport,
    identity: 'alice',
    clock: ports.clock,
    timers: ports.timers,
    createId: ports.createId,
  }).then((room) => {
    opened = true;
    return room;
  });
  try {
    for (let turn = 0; turn < 100; turn += 1) await Promise.resolve();
    expect(opened).toBe(true);
    const room = await opening;
    room.dispatch(AddOne({}));
    expect(readTally(room.getSnapshot())).toBe(1);
  } finally {
    release?.();
    (await opening).destroy();
    transport.destroy();
  }
});
