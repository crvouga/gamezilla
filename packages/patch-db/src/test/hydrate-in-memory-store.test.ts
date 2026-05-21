import { assert } from '@gamezilla/assert';
import { SqlClientImplBunSqlite } from '@gamezilla/sql-client/impl-bun-sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import { PATCH_CREATED_BY_ID, toAttributeState } from '../interface';
import { hydrateInMemoryStoreFromSqlite } from '../react/hydrate-in-memory-store';
import { InMemoryEntityStore } from '../react/in-memory-entity-store';

describe('hydrateInMemoryStoreFromSqlite', () => {
  let teardown: () => Promise<void>;
  let client: SqlClientImplBunSqlite;
  let local: PatchDbImplSqlite;

  beforeEach(async () => {
    client = SqlClientImplBunSqlite.open(':memory:');
    await client.connect();
    local = new PatchDbImplSqlite(client);
    await local.migrate();
    teardown = () => client.disconnect();
  });

  afterEach(async () => {
    await teardown();
  });

  test('fast hydration matches filtered read for well-formed snapshots', async () => {
    await local.write([
      {
        entityId: 'e1',
        entityType: 'todo',
        attributes: toAttributeState({ 'todo/title': 'hello' }),
      },
    ]);
    const store = new InMemoryEntityStore();
    await hydrateInMemoryStoreFromSqlite(local, store);
    const [readRes] = await local.read([{}]);
    assert.ok(
      readRes !== undefined && readRes !== null,
      'read must return one result'
    );
    const fromRead = readRes.entities.find((e) => e.entityId === 'e1');
    const fromStore = store.getEntity('todo', 'e1');
    expect(fromStore).not.toBeNull();
    const readAttrs = fromRead?.attributes as Record<string, unknown>;
    const storeAttrs = fromStore?.attributes as Record<string, unknown>;
    expect(readAttrs['todo/title']).toBe('hello');
    expect(storeAttrs['todo/title']).toBe('hello');
  });

  test('fast hydration retains non-keyword keys present in DB (trusted path)', async () => {
    await client.run(
      `INSERT OR REPLACE INTO snapshots (entity_id, entity_type, attributes) VALUES (?, ?, ?)`,
      [
        'e2',
        'todo',
        JSON.stringify({
          'not-valid-keyword': 99,
          'todo/title': 'ok',
        }),
      ]
    );
    const store = new InMemoryEntityStore();
    await hydrateInMemoryStoreFromSqlite(local, store);
    const ent = store.getEntity('todo', 'e2');
    const entAttrs = ent?.attributes as Record<string, unknown> | undefined;
    expect(entAttrs?.['not-valid-keyword']).toBe(99);
    expect(entAttrs?.['todo/title']).toBe('ok');
    const [readRes] = await local.read([{}]);
    assert.ok(
      readRes !== undefined && readRes !== null,
      'read must return one result'
    );
    const filtered = readRes.entities.find((e) => e.entityId === 'e2');
    const filteredAttrs = filtered?.attributes as Record<string, unknown>;
    expect(filteredAttrs['not-valid-keyword']).toBeUndefined();
  });
});

describe('InMemoryEntityStore mirror path', () => {
  test('applyPatchInputs merges keys without keyword validation', () => {
    const store = new InMemoryEntityStore();
    store.applyPatchInputs([
      {
        entityId: 'x1',
        entityType: 'todo',
        attributes: { 'legacy-un-namespaced': 42 } as never,
      },
    ]);
    expect(
      (store.getEntity('todo', 'x1')?.attributes as Record<string, unknown>)[
        'legacy-un-namespaced'
      ]
    ).toBe(42);
  });

  test('applyPatchInputs skips PATCH_META_KEYS', () => {
    const store = new InMemoryEntityStore();
    store.applyPatchInputs([
      {
        entityId: 'm1',
        entityType: 'todo',
        attributes: {
          ...toAttributeState({ 'todo/title': 't' }),
          [PATCH_CREATED_BY_ID]: 'device',
        } as never,
      },
    ]);
    const merged = store.getEntity('todo', 'm1')?.attributes as Record<
      string,
      unknown
    >;
    expect(merged[PATCH_CREATED_BY_ID]).toBeUndefined();
    expect(merged['todo/title']).toBe('t');
  });
});
