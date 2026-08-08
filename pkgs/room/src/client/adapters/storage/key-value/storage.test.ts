import { describe, expect, test } from 'bun:test';
import { KvImplInMemory } from '@pkgs/kv/impl-in-memory';
import type { KvRecord } from '@pkgs/kv/interface';

import { keyValueRoomClientKeywords } from './keys';
import { KeyValueClientRoomStorage } from './storage';

describe('KeyValueClientRoomStorage', () => {
  test('loadCommitted returns empty and zaps unreadable blobs', async () => {
    const kv = new KvImplInMemory();
    const { committed, queue } = keyValueRoomClientKeywords('corrupt-a');
    const bad = {
      'room.client.committed/last-seq': 'nope',
    } as unknown as KvRecord;
    await kv.put(committed, bad);
    const storage = new KeyValueClientRoomStorage(kv, committed, queue);
    await expect(storage.loadCommitted()).resolves.toEqual({
      lastSeq: 0,
      entries: [],
    });
    await expect(kv.get(committed)).resolves.toBeNull();
  });

  test('loadQueued returns empty and zaps unreadable blobs', async () => {
    const kv = new KvImplInMemory();
    const { committed, queue } = keyValueRoomClientKeywords('corrupt-b');
    const bad = {
      'room.client.queue/commands': 123,
    } as unknown as KvRecord;
    await kv.put(queue, bad);
    const storage = new KeyValueClientRoomStorage(kv, committed, queue);
    await expect(storage.loadQueued()).resolves.toEqual([]);
    await expect(kv.get(queue)).resolves.toBeNull();
  });
});
