import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import type { PatchesDbQuery } from '../interface';
import { PatchesDbQueryCache } from '../react/query-cache';
import { SubscribablePatchesDb } from '../subscribable';

type SchedulerArg = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

type ManualScheduler = {
  scheduler: SchedulerArg;
  pending: Map<unknown, () => void>;
  fire: (handle: unknown) => void;
};

function manualScheduler(): ManualScheduler {
  const pending = new Map<unknown, () => void>();
  let id = 0;
  const scheduler: SchedulerArg = {
    setTimeout: (fn) => {
      const handle = ++id;
      pending.set(handle, fn);
      return handle;
    },
    clearTimeout: (handle) => {
      pending.delete(handle);
    },
  };
  return {
    pending,
    scheduler,
    fire: (handle) => {
      const fn = pending.get(handle);
      pending.delete(handle);
      if (fn !== undefined) fn();
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('PatchesDbQueryCache', () => {
  let teardown: () => Promise<void>;
  let db: SubscribablePatchesDb;

  beforeEach(async () => {
    const client = SqlClientImplBunSqlite.open(':memory:');
    await client.connect();
    const localDb = new PatchDbImplSqlite(client);
    await localDb.migrate();
    const pubSub = new InMemoryPubSub();
    db = new SubscribablePatchesDb(localDb, pubSub);
    teardown = () => client.disconnect();
  });

  afterEach(async () => {
    await teardown();
  });

  test('starts with empty snapshot until first subscription delivery', async () => {
    const cache = new PatchesDbQueryCache(db);
    const query: PatchesDbQuery = { entityType: 'todo' };
    const queryKey = JSON.stringify(query);

    const initial = cache.getOrCreateResult(queryKey, query);
    expect(initial.entities).toEqual([]);
    expect(initial.total).toBe(0);

    let snapshot = initial;
    cache.subscribe(queryKey, query, () => {
      snapshot = cache.getResult(queryKey)!;
    });

    await flushMicrotasks();
    expect(snapshot.entities).toEqual([]);
    expect(snapshot.total).toBe(0);
  });

  test('shares one underlying subscription across multiple subscribers', async () => {
    const cache = new PatchesDbQueryCache(db);
    const query: PatchesDbQuery = { entityType: 'todo' };
    const queryKey = JSON.stringify(query);

    const calls = { a: 0, b: 0 };
    const unsubA = cache.subscribe(queryKey, query, () => {
      calls.a += 1;
    });
    const unsubB = cache.subscribe(queryKey, query, () => {
      calls.b += 1;
    });

    expect(cache.size()).toBe(1);

    await db.write([
      { entityId: 'a1', entityType: 'todo', attributes: { 'todo/n': 1 } },
    ]);
    await flushMicrotasks();

    expect(calls.a).toBeGreaterThan(0);
    expect(calls.b).toBeGreaterThan(0);
    expect(cache.size()).toBe(1);

    unsubA();
    unsubB();
  });

  test('serves cached snapshot synchronously to a late-joining subscriber', async () => {
    const cache = new PatchesDbQueryCache(db);
    const query: PatchesDbQuery = { entityType: 'todo' };
    const queryKey = JSON.stringify(query);

    const unsubFirst = cache.subscribe(queryKey, query, () => {});
    await db.write([
      { entityId: 'b1', entityType: 'todo', attributes: { 'todo/n': 1 } },
    ]);
    await flushMicrotasks();

    const cached = cache.getResult(queryKey);
    expect(cached?.entities.length).toBe(1);

    let observed = cache.getResult(queryKey);
    cache.subscribe(queryKey, query, () => {
      observed = cache.getResult(queryKey);
    });
    expect(observed?.entities.length).toBe(1);

    unsubFirst();
  });

  test('keeps the cache entry alive during the teardown grace window', async () => {
    const sched = manualScheduler();
    const cache = new PatchesDbQueryCache(db, {
      teardownGraceMs: 1_000,
      scheduler: sched.scheduler,
    });
    const query: PatchesDbQuery = { entityType: 'todo' };
    const queryKey = JSON.stringify(query);

    const unsub = cache.subscribe(queryKey, query, () => {});
    await db.write([
      { entityId: 'c1', entityType: 'todo', attributes: { 'todo/n': 1 } },
    ]);
    await flushMicrotasks();

    expect(cache.getResult(queryKey)?.entities.length).toBe(1);

    unsub();
    expect(cache.size()).toBe(1);
    expect(cache.isOpen(queryKey)).toBe(true);
    expect(sched.pending.size).toBe(1);

    cache.subscribe(queryKey, query, () => {});
    expect(sched.pending.size).toBe(0);
    expect(cache.getResult(queryKey)?.entities.length).toBe(1);
  });

  test('tears down the underlying subscription after grace expires', async () => {
    const sched = manualScheduler();
    const cache = new PatchesDbQueryCache(db, {
      teardownGraceMs: 1_000,
      scheduler: sched.scheduler,
    });
    const query: PatchesDbQuery = { entityType: 'todo' };
    const queryKey = JSON.stringify(query);

    const unsub = cache.subscribe(queryKey, query, () => {});
    await flushMicrotasks();
    unsub();

    expect(cache.size()).toBe(1);
    const [handle] = [...sched.pending.keys()];
    sched.fire(handle);

    expect(cache.size()).toBe(0);
    expect(cache.getResult(queryKey)).toBeNull();
  });

  test('snapshot identity stays stable when invalidations do not change rows', async () => {
    const cache = new PatchesDbQueryCache(db);
    const query: PatchesDbQuery = { entityType: 'todo' };
    const queryKey = JSON.stringify(query);

    cache.subscribe(queryKey, query, () => {});
    await db.write([
      { entityId: 'd1', entityType: 'todo', attributes: { 'todo/n': 1 } },
    ]);
    await flushMicrotasks();

    const before = cache.getResult(queryKey);
    expect(before?.entities.length).toBe(1);

    await db.write([
      {
        entityId: 'd2',
        entityType: 'unrelated',
        attributes: { 'unrelated/n': 1 },
      },
    ]);
    await flushMicrotasks();

    const after = cache.getResult(queryKey);
    expect(after).toBe(before);
    expect(after?.entities).toBe(before?.entities);
  });
});
