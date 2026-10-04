import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { KvImplInMemory } from '@pkgs/kv-shared/impl-in-memory';
import {
  committedSegmentKeyword,
  keyValueRoomClientKeywords,
} from '@pkgs/room-client/keys';
import { KeyValueClientRoomStorage } from '@pkgs/room-client/storage';
import { AddOne, TallyChanged } from '@pkgs/room-harness/game-room';
import { COMMITTED_LOG_SEGMENT_SIZE } from '@pkgs/room-shared/segmented-committed-log';
import type { LogEntry } from '@pkgs/room-shared/types';

function entry(seq: number): LogEntry {
  return { seq, event: TallyChanged({ by: seq }), ts: seq };
}

function range(from: number, to: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (let s = from; s <= to; s++) out.push(entry(s));
  return out;
}

describe('KeyValueClientRoomStorage (segmented)', () => {
  test('appends span segments and reload returns the full contiguous log', async () => {
    const kv = new KvImplInMemory();
    const keys = keyValueRoomClientKeywords(
      '11111111-2222-3333-4444-555555555555'
    );
    const storage = new KeyValueClientRoomStorage(
      kv,
      keys.committed,
      keys.queue
    );
    expect(await storage.loadCommitted()).toEqual({ lastSeq: 0, entries: [] });
    await storage.appendCommitted(range(1, 3));
    await storage.appendCommitted(range(4, COMMITTED_LOG_SEGMENT_SIZE + 10));
    await storage.appendCommitted(
      range(COMMITTED_LOG_SEGMENT_SIZE + 11, 3 * COMMITTED_LOG_SEGMENT_SIZE)
    );
    const reopened = new KeyValueClientRoomStorage(
      kv,
      keys.committed,
      keys.queue
    );
    const loaded = await reopened.loadCommitted();
    expect(loaded.lastSeq).toBe(3 * COMMITTED_LOG_SEGMENT_SIZE);
    expect(loaded.entries.map((e) => e.seq)).toEqual(
      range(1, 3 * COMMITTED_LOG_SEGMENT_SIZE).map((e) => e.seq)
    );
    expect(
      await kv.get(committedSegmentKeyword(keys.committed, 2))
    ).not.toBeNull();
    expect(await kv.get(committedSegmentKeyword(keys.committed, 3))).toBeNull();

    await reopened.appendCommitted(
      range(
        3 * COMMITTED_LOG_SEGMENT_SIZE + 1,
        3 * COMMITTED_LOG_SEGMENT_SIZE + 1
      )
    );
    expect((await reopened.loadCommitted()).lastSeq).toBe(
      3 * COMMITTED_LOG_SEGMENT_SIZE + 1
    );

    await reopened.resetCommitted();
    expect(await reopened.loadCommitted()).toEqual({ lastSeq: 0, entries: [] });
    expect(await kv.get(keys.committed)).toBeNull();
    expect(await kv.get(committedSegmentKeyword(keys.committed, 0))).toBeNull();
  });

  test('corrupt blobs load empty and are wiped; queue round-trips', async () => {
    const kv = new KvImplInMemory();
    const keys = keyValueRoomClientKeywords('abc');
    const storage = new KeyValueClientRoomStorage(
      kv,
      keys.committed,
      keys.queue
    );
    await storage.appendCommitted(range(1, 2));
    await kv.put(committedSegmentKeyword(keys.committed, 0), {
      [asKeyword('room.client.committed/entries')]: [{ seq: 'nope' }],
    });
    const fresh = new KeyValueClientRoomStorage(kv, keys.committed, keys.queue);
    expect(await fresh.loadCommitted()).toEqual({ lastSeq: 0, entries: [] });
    expect(await kv.get(keys.committed)).toBeNull();

    await kv.put(keys.queue, {
      [asKeyword('room.client.queue/commands')]: 'garbage',
    });
    expect(await fresh.loadQueued()).toEqual([]);
    expect(await kv.get(keys.queue)).toBeNull();
    const queue = [{ id: 'q1', ts: 1, payload: AddOne({}) }];
    await fresh.saveQueued(queue);
    expect(await fresh.loadQueued()).toEqual(queue);
    await fresh.saveQueued([]);
    expect(await fresh.loadQueued()).toEqual([]);
  });
});
