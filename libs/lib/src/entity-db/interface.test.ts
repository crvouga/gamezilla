import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '../assert';
import { ENTITY_DB_LIMITS } from './interface';
import type { EntityDb } from './interface';
import { createEntityDb, createEntityDbInMemory } from './factory';
import { EntityDbImplInMemory } from './impl-in-memory';
import type { SqlClient } from '../sql-client/interface';

/** Node crash handler calls `process.exit`; register one that throws so tests can assert failures. */
function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

type V = { v: number };

function asV(value: unknown): V {
  assert.record(value, 'test: expected V row');
  assert.ok(
    typeof value['v'] === 'number',
    'test: expected V.v to be a number'
  );
  return value as V;
}

function compareByVersion(incoming: unknown, existing: unknown): -1 | 0 | 1 {
  const i = asV(incoming);
  const e = asV(existing);
  if (i.v > e.v) return 1;
  if (i.v < e.v) return -1;
  return 0;
}

export function runEntityDbContractTests(
  factory: () => EntityDb | Promise<EntityDb>
): void {
  test('get returns null for missing key', async () => {
    const db = await Promise.resolve(factory());
    expect(
      await db.get({ namespace: 'n', type: 't', id: 'missing' })
    ).toBeNull();
  });

  test('upsert new then get', async () => {
    const db = await Promise.resolve(factory());
    const r = await db.upsert({
      namespace: 'n',
      type: 't',
      id: '1',
      data: { v: 1 },
      metadata: { x: 1 },
    });
    expect(r.applied).toBe(true);
    const got = await db.get({ namespace: 'n', type: 't', id: '1' });
    assert.defined(got, 'expected row');
    expect(got.data).toEqual({ v: 1 });
    expect(got.metadata).toEqual({ x: 1 });
    expect(got.lastModifiedAt).toBeInstanceOf(Date);
  });

  test('upsert overwrites when compareVersions > 0', async () => {
    const db = await Promise.resolve(factory());
    await db.upsert({
      namespace: 'n',
      type: 't',
      id: 'x',
      data: { v: 1 },
    });
    const r = await db.upsert({
      namespace: 'n',
      type: 't',
      id: 'x',
      data: { v: 2 },
    });
    expect(r.applied).toBe(true);
    const got = await db.get({ namespace: 'n', type: 't', id: 'x' });
    assert.defined(got, 'expected row');
    expect(got.data).toEqual({ v: 2 });
  });

  test('upsert skips when compareVersions <= 0', async () => {
    const db = await Promise.resolve(factory());
    await db.upsert({
      namespace: 'n',
      type: 't',
      id: 'y',
      data: { v: 10 },
      metadata: { m: 1 },
    });
    const before = await db.get({ namespace: 'n', type: 't', id: 'y' });
    assert.defined(before, 'before');
    const r = await db.upsert({
      namespace: 'n',
      type: 't',
      id: 'y',
      data: { v: 5 },
      metadata: { m: 2 },
    });
    expect(r.applied).toBe(false);
    const after = await db.get({ namespace: 'n', type: 't', id: 'y' });
    assert.defined(after, 'after');
    expect(after.data).toEqual({ v: 10 });
    expect(after.metadata).toEqual({ m: 1 });
    expect(after.lastModifiedAt.getTime()).toBe(before.lastModifiedAt.getTime());
  });

  test('delete is idempotent', async () => {
    const db = await Promise.resolve(factory());
    await db.delete({ namespace: 'n', type: 't', id: 'ghost' });
    await db.upsert({
      namespace: 'n',
      type: 't',
      id: 'z',
      data: { v: 1 },
    });
    await db.delete({ namespace: 'n', type: 't', id: 'z' });
    await db.delete({ namespace: 'n', type: 't', id: 'z' });
    expect(await db.get({ namespace: 'n', type: 't', id: 'z' })).toBeNull();
  });

  test('same id is isolated by namespace and type', async () => {
    const db = await Promise.resolve(factory());
    await db.upsert({
      namespace: 'a',
      type: 't',
      id: 'same',
      data: { v: 1 },
    });
    await db.upsert({
      namespace: 'b',
      type: 't',
      id: 'same',
      data: { v: 2 },
    });
    await db.upsert({
      namespace: 'a',
      type: 'u',
      id: 'same',
      data: { v: 3 },
    });
    expect(
      (await db.get({ namespace: 'a', type: 't', id: 'same' }))?.data
    ).toEqual({ v: 1 });
    expect(
      (await db.get({ namespace: 'b', type: 't', id: 'same' }))?.data
    ).toEqual({ v: 2 });
    expect(
      (await db.get({ namespace: 'a', type: 'u', id: 'same' }))?.data
    ).toEqual({ v: 3 });
  });

  test('metadata defaults to empty object', async () => {
    const db = await Promise.resolve(factory());
    await db.upsert({
      namespace: 'n',
      type: 't',
      id: 'md',
      data: { v: 1 },
    });
    const got = await db.get({ namespace: 'n', type: 't', id: 'md' });
    assert.defined(got, 'row');
    expect(got.metadata).toEqual({});
  });
}

describe('entity-db interface', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerThrowingCrashHandlerForTests();
  });
  afterAll(() => {
    disposeCrash();
  });

describe('EntityDbImplInMemory (contract)', () => {
  runEntityDbContractTests(() => createEntityDbInMemory(compareByVersion));
});

describe('entity-db tiger violations (in-memory)', () => {
  test('empty namespace throws', () => {
    const db = createEntityDbInMemory(compareByVersion);
    expect(() =>
      db.get({ namespace: '', type: 't', id: 'i' })
    ).toThrow();
  });

  test('key length overflow throws', () => {
    const db = createEntityDbInMemory(compareByVersion);
    const long = 'x'.repeat(ENTITY_DB_LIMITS.MAX_NAMESPACE_LEN + 1);
    expect(() =>
      db.get({ namespace: long, type: 't', id: 'i' })
    ).toThrow();
  });

  test('NUL in key throws', () => {
    const db = createEntityDbInMemory(compareByVersion);
    expect(() =>
      db.get({ namespace: 'a\0b', type: 't', id: 'i' })
    ).toThrow();
  });

  test('data undefined on upsert throws', () => {
    const db = createEntityDbInMemory(compareByVersion);
    expect(() =>
      db.upsert({
        namespace: 'n',
        type: 't',
        id: 'i',
        data: undefined,
      })
    ).toThrow();
  });

  test('compareVersions invalid return throws', async () => {
    const raw = new EntityDbImplInMemory((_a, _b) => 2 as unknown as -1);
    await raw.upsert({
      namespace: 'n',
      type: 't',
      id: 'x',
      data: { v: 1 } satisfies V,
    });
    await expect(
      raw.upsert({
        namespace: 'n',
        type: 't',
        id: 'x',
        data: { v: 2 } satisfies V,
      })
    ).rejects.toThrow();
  });

  test('payload over MAX_JSON_BYTES throws', () => {
    const db = createEntityDbInMemory(compareByVersion);
    const big = 'z'.repeat(ENTITY_DB_LIMITS.MAX_JSON_BYTES);
    expect(() =>
      db.upsert({
        namespace: 'n',
        type: 't',
        id: 'big',
        data: { v: 1, big },
      })
    ).toThrow();
  });

  test('unsafe tableName throws at createEntityDb', () => {
    const noopSql = {
      connect: async () => {},
      disconnect: async () => {},
      query: async () => [],
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      transaction: async <R,>(fn: (tx: SqlClient) => Promise<R>) =>
        fn(noopSql as SqlClient),
      prepare: () => ({
        query: async () => [],
        run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      }),
    } as SqlClient;
    expect(() =>
      createEntityDb({
        sqlClient: noopSql,
        tableName: 'bad;',
        compareVersions: compareByVersion,
      })
    ).toThrow();
  });
});

});
