import { describe, expect, test } from 'bun:test';
import { WebClientStorage } from '@pkgs/room-adapter-web-shared/client-storage';
import { COMMITTED_LOG_SEGMENT_SIZE } from '@pkgs/room-root-shared/segmented-committed-log';
import type { LogEntry } from '@pkgs/room-root-shared/types';

class MapStorage {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function entry(seq: number): LogEntry {
  return {
    seq,
    event: { type: 'evt/moved' as never, payload: { seq } },
    ts: seq,
  };
}

function range(from: number, to: number): LogEntry[] {
  const out: LogEntry[] = [];
  for (let s = from; s <= to; s++) out.push(entry(s));
  return out;
}

describe('WebClientStorage (segmented localStorage)', () => {
  test('append writes only the tail segment; reload restores everything', async () => {
    const backing = new MapStorage();
    const storage = new WebClientStorage('room:t', backing);
    await storage.appendCommitted(range(1, COMMITTED_LOG_SEGMENT_SIZE));
    await storage.appendCommitted(
      range(COMMITTED_LOG_SEGMENT_SIZE + 1, COMMITTED_LOG_SEGMENT_SIZE + 1)
    );
    expect([...backing.map.keys()].sort()).toEqual([
      'room:t:committed',
      'room:t:committed.0',
      'room:t:committed.1',
    ]);
    const seg0 = backing.map.get('room:t:committed.0')!;
    await storage.appendCommitted(
      range(COMMITTED_LOG_SEGMENT_SIZE + 2, COMMITTED_LOG_SEGMENT_SIZE + 2)
    );
    expect(backing.map.get('room:t:committed.0')).toBe(seg0);

    const reopened = new WebClientStorage('room:t', backing);
    const loaded = await reopened.loadCommitted();
    expect(loaded.lastSeq).toBe(COMMITTED_LOG_SEGMENT_SIZE + 2);
    expect(loaded.entries).toHaveLength(COMMITTED_LOG_SEGMENT_SIZE + 2);
    await reopened.resetCommitted();
    expect(backing.map.size).toBe(0);
  });

  test('legacy whole-log blob and corrupt segments read as empty and are cleared', async () => {
    const backing = new MapStorage();
    backing.setItem(
      'room:t:committed',
      JSON.stringify({ lastSeq: 2, entries: range(1, 2) })
    );
    const storage = new WebClientStorage('room:t', backing);
    expect(await storage.loadCommitted()).toEqual({ lastSeq: 0, entries: [] });
    expect(backing.map.size).toBe(0);

    await storage.appendCommitted(range(1, 2));
    backing.setItem('room:t:committed.0', '{not json');
    const again = new WebClientStorage('room:t', backing);
    expect(await again.loadCommitted()).toEqual({ lastSeq: 0, entries: [] });
    expect(backing.map.size).toBe(0);
  });

  test('queue snapshot round-trips', async () => {
    const backing = new MapStorage();
    const storage = new WebClientStorage('room:t', backing);
    expect(await storage.loadQueued()).toEqual([]);
    const queue = [
      { id: 'a', ts: 1, payload: { type: 'cmd/x' as never, payload: 1 } },
    ];
    await storage.saveQueued(queue);
    expect(await storage.loadQueued()).toEqual(queue);
  });
});
