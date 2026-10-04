import { expect, test } from 'bun:test';
import { DurableObjectRoomStorage } from '@pkgs/room-adapter-durable-object-shared/storage';
import {
  AddOne,
  gameRoomModule,
  readTally,
  TallyChanged,
} from '@pkgs/room-root-harness/game-room';
import { RoomServer } from '@pkgs/room-root-server/room-server';
import { ROOM_WIRE_KIND, WIRE_VERSION } from '@pkgs/room-root-shared/wire';
import { MemoryKv } from './memory-kv';

async function open(kv: MemoryKv) {
  const server = new RoomServer({
    topic: 'room:one',
    module: gameRoomModule,
    storage: new DurableObjectRoomStorage(kv),
    clock: { now: () => 1700000000000 },
  });
  await server.hydrateFromStorage();
  server.registerConnection('alice', () => undefined, {
    id: 'alice',
    clientId: 'phone',
  });
  return server;
}

const CHANGE = {
  v: WIRE_VERSION,
  kind: ROOM_WIRE_KIND.command,
  id: 'alice-change-1',
  ts: 1700000000000,
  payload: AddOne({}),
};

test('a stop after saving an event cannot count its retry twice', async () => {
  // regression: room-event-saved-without-retry-verdict
  const kv = new MemoryKv();
  const first = await open(kv);
  kv.interruptAfterEventWrite = true;
  await expect(
    first.handleClientMessage('alice', 'alice', CHANGE)
  ).rejects.toThrow('stopped after event write');
  const restarted = await open(kv);
  await restarted.handleClientMessage('alice', 'alice', CHANGE);
  await restarted.handleClientMessage('alice', 'alice', CHANGE);
  expect(readTally(restarted.getCommittedState())).toBe(1);
  expect(
    await new DurableObjectRoomStorage(kv).loadEventsAfter('room:one', 0)
  ).toHaveLength(1);
});

test('a lost storage reply reloads the live room before its next command', async () => {
  // regression: room-storage-reply-lost-stale-tip
  const kv = new MemoryKv();
  const server = await open(kv);
  kv.interruptAfterTransaction = true;
  await expect(
    server.handleClientMessage('alice', 'alice', CHANGE)
  ).rejects.toThrow('stopped after transaction committed');
  await server.handleClientMessage('alice', 'alice', CHANGE);
  await server.handleClientMessage('alice', 'alice', {
    ...CHANGE,
    id: 'alice-change-2',
  });
  expect(readTally(server.getCommittedState())).toBe(2);
  expect(await new DurableObjectRoomStorage(kv).getLastSeq('room:one')).toBe(2);
});

test('an interrupted multi-batch command saves neither a prefix nor a retry verdict', async () => {
  // regression: room-event-saved-without-retry-verdict
  const kv = new MemoryKv();
  const storage = new DurableObjectRoomStorage(kv);
  await storage.getLastSeq('room:one');
  const entries = Array.from({ length: 129 }, (_, i) => ({
    seq: i + 1,
    event: TallyChanged({ by: 1 }),
  }));
  kv.failPutNumber = kv.puts + 2;
  await expect(
    storage.commitCommand('room:one', 'many-events', entries)
  ).rejects.toThrow('interrupted write');
  expect(await storage.loadEventsAfter('room:one', 0)).toEqual([]);
  expect(await storage.getLastSeq('room:one')).toBe(0);
  expect(await storage.getDedupOutcome('room:one', 'many-events')).toBeNull();
  kv.failPutNumber = null;
  await storage.commitCommand('room:one', 'many-events', entries);
  await storage.commitCommand('room:one', 'many-events', entries);
  expect(await storage.loadEventsAfter('room:one', 0)).toHaveLength(129);
  expect(await storage.getDedupOutcome('room:one', 'many-events')).toEqual({
    kind: 'committed',
    entries,
  });
});
