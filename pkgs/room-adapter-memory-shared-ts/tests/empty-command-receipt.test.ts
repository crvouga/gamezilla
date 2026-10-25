import { expect, test } from 'bun:test';
import { InMemoryRoomStorage } from '@pkgs/room-adapter-memory-shared-ts/room-storage';

test('an accepted no-op keeps its retry verdict without growing history', async () => {
  // regression: room-empty-command-lost-receipt
  const storage = new InMemoryRoomStorage();
  await storage.commitCommand('room:one', 'no-op', []);
  expect(await storage.getDedupOutcome('room:one', 'no-op')).toEqual({
    kind: 'committed',
    entries: [],
  });
  expect(await storage.getLastSeq('room:one')).toBe(0);
  expect(await storage.loadEventsAfter('room:one', 0)).toEqual([]);
});
