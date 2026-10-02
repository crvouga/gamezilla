import { expect, test } from 'bun:test';
import { LAST_LOCAL_ACCOUNT_ID_KEY } from '@libs/auth/public/auth-storage-keys';
import { harnessClientSql } from '@libs/harness/fabric/client-sql';
import type { HarnessSql } from '@libs/harness/fabric/sql';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite';
import { createInMemorySecureStorage } from '@pkgs/secure-storage/impl-memory';
import { createSecureStorageStore } from '@pkgs/secure-storage/secure-storage-store';
import { sql } from '@pkgs/sql';

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
