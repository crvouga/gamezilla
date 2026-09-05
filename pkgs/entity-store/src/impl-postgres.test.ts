import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { createSimAdapters } from '@pkgs/uuid';
import { EntityStoreImplPostgres } from './impl-postgres';

const adapters = createSimAdapters({ seed: 1 });

describe('EntityStoreImplPostgres', () => {
  let sqlClient: SqlClient;

  beforeAll(async () => {
    sqlClient = SqlClientImplPostgresMem.open({ seed: 1 });
    await sqlClient.connect();
  });

  afterAll(async () => {
    await sqlClient.disconnect();
  });

  test('migrateUp + upsert + get + delete', async () => {
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
