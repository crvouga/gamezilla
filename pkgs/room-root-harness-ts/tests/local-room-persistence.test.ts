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

// regression: room-local-persistence-failure-hidden
test('a failed local save cannot confirm durability and a later save can recover', async () => {
  const storage = new CountingClientStorage();
  const save = storage.saveQueued.bind(storage);
  storage.saveQueued = async () => {
    throw new Error('device storage full');
  };
  const ports = testPorts();
  const room = await RoomClient.open({
    topic: 'local-room',
    module: gameRoomModule,
    storage,
    transport: new FakeTransport(),
    identity: 'alice',
    ...ports,
  });
  try {
    expect(room.dispatch(AddOne({}))).not.toBeNull();
    await expect(room.flushIo()).rejects.toThrow('device storage full');
    storage.saveQueued = save;
    expect(room.dispatch(AddOne({}))).not.toBeNull();
    await room.flushIo();
    expect(storage.queue).toHaveLength(2);
    expect(readTally(room.getSnapshot())).toBe(2);
  } finally {
    room.destroy();
  }
});
