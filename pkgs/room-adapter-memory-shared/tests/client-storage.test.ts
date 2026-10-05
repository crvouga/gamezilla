import { describe, expect, test } from 'bun:test';
import { InMemoryClientStorage } from '@pkgs/room-adapter-memory-shared/client-storage';
import type { LogEntry } from '@pkgs/room-root-shared/types';

function entry(seq: number): LogEntry {
  return { seq, event: { type: 'evt/x' as never, payload: seq } };
}

describe('InMemoryClientStorage', () => {
  test('append / reset / queue snapshot semantics', async () => {
    const s = new InMemoryClientStorage();
    await s.appendCommitted([entry(1), entry(2)]);
    await s.appendCommitted([entry(3)]);
    const loaded = await s.loadCommitted();
    expect(loaded.lastSeq).toBe(3);
    expect(loaded.entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    loaded.entries.push(entry(99));
    expect((await s.loadCommitted()).entries).toHaveLength(3);
    const queue = [
      { id: 'q', ts: 1, payload: { type: 'cmd/x' as never, payload: 1 } },
    ];
    await s.saveQueued(queue);
    queue.push({
      id: 'z',
      ts: 2,
      payload: { type: 'cmd/x' as never, payload: 2 },
    });
    expect(await s.loadQueued()).toHaveLength(1);
    await s.resetCommitted();
    expect(await s.loadCommitted()).toEqual({ lastSeq: 0, entries: [] });
  });
});
