import { expect, test } from 'bun:test';
import { DurableObjectRoomStorage } from '@pkgs/room-adapter-durable-object-shared-ts/storage';
import { MemoryKv } from './memory-kv';

test('an accepted no-op retains its retry verdict across storage recreation', async () => {
  // regression: room-empty-command-lost-receipt
  const kv = new MemoryKv();
  await new DurableObjectRoomStorage(kv).commitCommand('room:one', 'no-op', []);
  const restored = new DurableObjectRoomStorage(kv);
  expect(await restored.getDedupOutcome('room:one', 'no-op')).toEqual({
    kind: 'committed',
    entries: [],
  });
  expect(await restored.getLastSeq('room:one')).toBe(0);
  expect(await restored.loadEventsAfter('room:one', 0)).toEqual([]);
});
