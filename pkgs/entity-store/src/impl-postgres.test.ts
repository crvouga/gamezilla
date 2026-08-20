import { afterEach, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { createLogger } from '@pkgs/logger';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { createSimAdapters } from '@pkgs/uuid';
import { EntityStoreImplPostgres } from './impl-postgres';

const adapters = createSimAdapters({ seed: 1 });

describe('EntityStoreImplPostgres', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (close !== undefined) {
      await close();
      close = undefined;
    }
  });

  test('migrateUp + upsert + get + delete', async () => {
    const db = await PGlite.create();
    const sqlClient = createPgliteSqlClient(db);
    close = async () => {
      await db.close();
    };

    const logger = createLogger({
      name: 'entity-store-test',
      now: adapters.clock.now,
    });
    await EntityStoreImplPostgres.migrateUp({ sqlClient, logger });
    await EntityStoreImplPostgres.migrateUp({ sqlClient, logger });

    const store = new EntityStoreImplPostgres(sqlClient, adapters.clock.now);
    await store.upsert({
      namespace: 'test',
      type: 'thing',
      externalId: 'ext_1',
      ownerId: 'owner_1',
      data: { hello: 'world' },
    });

    const row = await store.get({
      namespace: 'test',
      type: 'thing',
      externalId: 'ext_1',
    });
    expect(row).not.toBeNull();
    expect(row?.id).toBe('test/thing/ext_1');
    expect(row?.ownerId).toBe('owner_1');
    expect(row?.data['hello']).toBe('world');

    await store.upsert({
      namespace: 'test',
      type: 'thing',
      externalId: 'ext_1',
      ownerId: 'owner_2',
      data: { hello: 'updated' },
    });
    const updated = await store.get({
      namespace: 'test',
      type: 'thing',
      externalId: 'ext_1',
    });
    expect(updated?.ownerId).toBe('owner_2');
    expect(updated?.data['hello']).toBe('updated');

    await store.delete({
      namespace: 'test',
      type: 'thing',
      externalId: 'ext_1',
    });
    expect(
      await store.get({
        namespace: 'test',
        type: 'thing',
        externalId: 'ext_1',
      })
    ).toBeNull();
  });
});
