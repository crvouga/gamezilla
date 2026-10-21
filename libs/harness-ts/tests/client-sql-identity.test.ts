import { expect, test } from 'bun:test';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { harnessClientSql } from '@libs/harness-ts/client-sql';
import type { HarnessSql } from '@libs/harness-ts/sql-types';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { createInMemorySecureStorage } from '@pkgs/secure-storage-root-shared-ts/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage-root-shared-ts/secure-storage-store';
import sql from '@pkgs/sql-root-shared-ts/sql';

const PROFILE = defineTable({
  name: 'profile',
  domain: 'profile',
  columns: { username: 'text' },
  uniqueIndexes: [['username']],
});

test('a fresh account has its own database while the earlier account keeps its saved rows', async () => {
  // regression: harness-client-sql-identity
  const handles = new Map<string, HarnessSql>();
  const storage = createSecureStorageStore(createInMemorySecureStorage());
  const input = { id: 'alice', handles, clock: { now: () => 1000 }, storage };
  const open = harnessClientSql(input);
  try {
    const old = await open({ userId: 'deleted-account' });
    await reconcileSqliteSchema(old, registerTables([PROFILE]));
    await old.run(
      sql`INSERT INTO profile (id, username) VALUES (${'deleted-account'}, ${'alice'})`
    );
    await storage.write(LAST_LOCAL_ACCOUNT_ID_KEY, 'fresh-account');
    const fresh = await open({ userId: 'fresh-account' });
    await reconcileSqliteSchema(fresh, registerTables([PROFILE]));
    expect(
      await fresh.query(sql<{ id: string }>`SELECT * FROM profile`)
    ).toEqual([]);
    await fresh.run(
      sql`INSERT INTO profile (id, username) VALUES (${'fresh-account'}, ${'alice'})`
    );
    expect(
      await handles
        .get('alice')
        ?.sqlClient.query(sql<{ id: string }>`SELECT id FROM profile`)
    ).toEqual([{ id: 'fresh-account' }]);
    const inspection = await open();
    expect(
      await inspection.query(sql<{ id: string }>`SELECT id FROM profile`)
    ).toEqual([{ id: 'fresh-account' }]);
    const reopened = await harnessClientSql(input)({
      userId: 'deleted-account',
    });
    expect(
      await reopened.query(sql<{ id: string }>`SELECT id FROM profile`)
    ).toEqual([{ id: 'deleted-account' }]);
    expect(
      await fresh.query(sql<{ id: string }>`SELECT id FROM profile`)
    ).toEqual([{ id: 'fresh-account' }]);
  } finally {
    await handles.get('alice')?.disconnect();
  }
});
