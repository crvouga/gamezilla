import { describe, expect, mock, test } from 'bun:test';
import { KvImplInMemory } from '@pkgs/kv-root-shared/impl-in-memory';
import {
  CommandRegistryStore,
  createCommandRegistryStore,
} from '@pkgs/ui-root-client/command-registry-store';
import type { RegisteredCommand } from '@pkgs/ui-root-client/types';
import {
  COMMAND_HISTORY_DEFAULT_LIMIT,
  HistoryStore,
} from '@pkgs/ui-root-shared/history-store';

function cmd(id: string, title = id): RegisteredCommand {
  return { id, title, run: () => {}, _version: 0 };
}

describe('CommandRegistryStore', () => {
  test('upsert / remove notify subscribers and bump the snapshot', () => {
    const store = createCommandRegistryStore();
    expect(store).toBeInstanceOf(CommandRegistryStore);
    const listener = mock();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();

    store.upsert(cmd('a'), 'owner-1');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().map((c) => c.id)).toEqual(['a']);
    expect(store.get('a')?.title).toBe('a');
    expect(store.getVersion()).toBe(1);

    store.remove('a', 'owner-1');
    expect(store.getSnapshot()).toEqual([]);
    expect(store.get('a')).toBeUndefined();

    unsubscribe();
    store.upsert(cmd('b'), 'owner-1');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test('remove only affects the registering owner; upsert overwrites', () => {
    const store = new CommandRegistryStore();
    store.upsert(cmd('a', 'first'), 'owner-1');
    store.upsert(cmd('a', 'second'), 'owner-2');
    expect(store.get('a')?.title).toBe('second');
    store.remove('a', 'owner-1');
    expect(store.get('a')?.title).toBe('second');
    store.remove('a', 'owner-2');
    expect(store.get('a')).toBeUndefined();
    expect(store.getAll()).toEqual([]);
  });

  test('getSnapshot is stable between mutations', () => {
    const store = new CommandRegistryStore();
    store.upsert(cmd('a'), 'o');
    const snap = store.getSnapshot();
    expect(store.getSnapshot()).toBe(snap);
    expect(store.getAll()).not.toBe(snap);
  });
});

describe('HistoryStore', () => {
  test('touch moves ids to the front, dedupes, and caps at the limit', () => {
    const history = new HistoryStore({ limit: 3 });
    const listener = mock();
    history.subscribe(listener);
    history.touch('a');
    history.touch('b');
    history.touch('a');
    expect(history.getIds()).toEqual(['a', 'b']);
    history.touch('c');
    history.touch('d');
    expect(history.getIds()).toEqual(['d', 'c', 'a']);
    expect(listener).toHaveBeenCalledTimes(5);
    expect(history.getSnapshot()).toEqual(['d', 'c', 'a']);
  });

  test('default limit applies without options', () => {
    const history = new HistoryStore();
    for (let i = 0; i < COMMAND_HISTORY_DEFAULT_LIMIT + 5; i++) {
      history.touch(`c${i}`);
    }
    expect(history.getIds()).toHaveLength(COMMAND_HISTORY_DEFAULT_LIMIT);
  });

  test('persists to Kv and hydrates from it', async () => {
    const kv = new KvImplInMemory();
    const a = new HistoryStore({ kv, limit: 5 });
    await a.hydrate();
    a.touch('x');
    a.touch('y');
    // Persistence is async; give the write a tick.
    await Promise.resolve();
    await Promise.resolve();

    const b = new HistoryStore({ kv, limit: 5 });
    expect(b.getIds()).toEqual([]);
    await b.hydrate();
    expect(b.getIds()).toEqual(['y', 'x']);
  });

  test('hydrate merges ids touched before the load completes', async () => {
    const kv = new KvImplInMemory();
    const seed = new HistoryStore({ kv });
    seed.touch('old');
    await Promise.resolve();
    await Promise.resolve();

    const store = new HistoryStore({ kv });
    const pending = store.hydrate();
    store.touch('fresh');
    await pending;
    expect(store.getIds()).toEqual(['fresh', 'old']);
  });
});
