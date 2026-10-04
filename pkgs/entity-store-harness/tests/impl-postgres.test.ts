import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { EntityStoreImplPostgres } from '@pkgs/entity-store-shared/impl-postgres';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

const adapters = createHarnessAdapters({ seed: 1 });

describe('EntityStoreImplPostgres', () => {
  let sqlClient: SqlClient;

  beforeAll(async () => {
    sqlClient = SqlClientImplMockingbirdPostgres.open({ seed: 1 });
    await sqlClient.connect();
  });

  afterAll(async () => {
    await sqlClient.disconnect();
  });

  test('reconcile + upsert + get + delete', async () => {
    await EntityStoreImplPostgres.reconcile(sqlClient);
    await EntityStoreImplPostgres.reconcile(sqlClient);

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
