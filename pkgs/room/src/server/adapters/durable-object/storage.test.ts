import { describe, expect, test } from 'bun:test';
import { asKeyword } from '@pkgs/keyword';
import type { LogEntry } from '../../../types';
import { assertRoomModuleName } from '../../../types';
import { DurableObjectRoomStorage } from './storage';
import { eventKey, roomDoKeyNs } from './storage-keys';
import type {
  DurableObjectKvListOptions,
  DurableObjectKvStorage,
} from './types';

function missesPrefix(k: string, prefix: string | undefined): boolean {
  return prefix !== undefined && !k.startsWith(prefix);
}

function outsideStart(
  k: string,
  options?: DurableObjectKvListOptions
): boolean {
  if (options?.startAfter !== undefined && k <= options.startAfter) return true;
  if (options?.start !== undefined && k < options.start) return true;
  return false;
}

function pastEnd(k: string, end: string | undefined): boolean {
  return end !== undefined && k >= end;
}

function keyInListRange(
  k: string,
  options?: DurableObjectKvListOptions
): boolean {
  if (missesPrefix(k, options?.prefix)) return false;
  if (outsideStart(k, options)) return false;
  if (pastEnd(k, options?.end)) return false;
  return true;
}

class MemoryDoKv implements DurableObjectKvStorage {
  readonly map = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async put(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown
  ): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.map.set(keyOrEntries, value);
      return;
    }
    for (const [k, v] of Object.entries(keyOrEntries)) {
      this.map.set(k, v);
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.map.delete(key);
  }

  async list<T = unknown>(
    options?: DurableObjectKvListOptions
  ): Promise<Map<string, T>> {
    const keys = [...this.map.keys()].sort();
    const out = new Map<string, T>();
    for (const k of keys) {
      if (!keyInListRange(k, options)) continue;
      out.set(k, this.map.get(k) as T);
      if (options?.limit !== undefined && out.size >= options.limit) break;
    }
    return out;
  }
}

function entry(seq: number): LogEntry {
  return {
    seq,
    event: { type: asKeyword('test/ee'), payload: { seq } },
  };
}

describe('DurableObjectRoomStorage', () => {
  test('appends events and loads after seq without a monolithic blob', async () => {
    const kv = new MemoryDoKv();
    const mod = assertRoomModuleName('space');
    const storage = new DurableObjectRoomStorage(kv, mod);
    await storage.appendCommittedEntries('t', [entry(1), entry(2)]);
    await storage.appendCommittedEntries('t', [entry(3)]);
    expect(await storage.getLastSeq('t')).toBe(3);
    expect(await storage.loadEventsAfter('t', 1)).toEqual([entry(2), entry(3)]);
    const ns = roomDoKeyNs(mod);
    expect(kv.map.has(ns.legacyBlob)).toBe(false);
    expect(kv.map.has(eventKey(ns, 1))).toBe(true);
  });

  test('stores dedup outcomes under their own keys', async () => {
    const kv = new MemoryDoKv();
    const storage = new DurableObjectRoomStorage(kv);
    await storage.putDedupOutcome('t', 'cmd-1', {
      kind: 'rejected',
      error: { type: asKeyword('room.error/invalid-command'), reason: 'x' },
    });
    const prior = await storage.getDedupOutcome('t', 'cmd-1');
    expect(prior?.kind).toBe('rejected');
    expect(await storage.getDedupOutcome('t', 'missing')).toBeNull();
  });

  test('migrates legacy v2 blob into per-key v3 storage', async () => {
    const kv = new MemoryDoKv();
    const mod = assertRoomModuleName('chess');
    const ns = roomDoKeyNs(mod);
    await kv.put(ns.legacyBlob, {
      events: [entry(1), entry(2)],
      dedup: {
        c1: { kind: 'committed', entries: [entry(1)] },
      },
    });
    const storage = new DurableObjectRoomStorage(kv, mod);
    expect(await storage.loadEventsAfter('t', 0)).toEqual([entry(1), entry(2)]);
    expect(await storage.getLastSeq('t')).toBe(2);
    expect(await storage.getDedupOutcome('t', 'c1')).toEqual({
      kind: 'committed',
      entries: [entry(1)],
    });
    expect(kv.map.has(ns.legacyBlob)).toBe(false);
    await storage.appendCommittedEntries('t', [entry(3)]);
    expect(await storage.getLastSeq('t')).toBe(3);
  });

  test('rejects seq gaps on append', async () => {
    const storage = new DurableObjectRoomStorage(new MemoryDoKv());
    await storage.appendCommittedEntries('t', [entry(1)]);
    await expect(
      storage.appendCommittedEntries('t', [entry(3)])
    ).rejects.toThrow(/expected seq 2/);
  });
});
