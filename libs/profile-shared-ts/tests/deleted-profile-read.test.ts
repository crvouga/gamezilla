import { expect, test } from 'bun:test';
import { profileRowByIdSql } from '@libs/profile-shared-ts/profile-row-sql';
import { profilesByIds } from '@libs/profile-shared-ts/profiles-by-ids-query';
import { ProfileReadRepository } from '@libs/profile-shared-ts/read-profile';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';

test('a retained tombstone is absent from profile display reads', async () => {
  // regression: deleted-profile-display
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(PROFILE_TABLES));
    await db.run(
      sql`INSERT INTO profile (id, username, username_norm, avatar_config, created_at, deleted_at) VALUES (${'alice'}, ${'alice'}, ${'alice'}, ${'{}'}, ${'2026-10-01T00:00:00.000Z'}, ${'2026-10-01T00:01:00.000Z'})`
    );
    const profiles = new ProfileReadRepository(db);
    expect(await profiles.readCardById('alice')).toBeNull();
    expect(await profiles.readCardsByIds(['alice'])).toEqual([]);
    expect(await db.query(profileRowByIdSql('alice'))).toEqual([]);
  } finally {
    await db.disconnect();
  }
});

// regression: deleted-profiles-share-one-username-index-key
test('two deleted profiles can be synchronized to the same device', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  const device = SqlClientImplMockingbirdSqlite.open();
  const deleted = '2026-11-24T23:02:03.000Z';
  try {
    for (const store of [db, device]) {
      await store.connect();
      await reconcileSqliteSchema(store, registerTables(PROFILE_TABLES));
    }
    for (const id of ['alice', 'bob']) {
      await db.run(
        sql`INSERT INTO profile (id, username, username_norm, deleted_at) VALUES (${id}, ${id}, ${id}, ${deleted})`
      );
    }
    const snapshot = await profilesByIds.run(
      {
        db: { query: (statement) => db.query(sql<QueryRow>`${statement}`) },
        env: {
          actorId: 'carol',
          deviceId: 'phone',
          accountId: 'carol',
          isAnon: false,
          now: () => new Date(deleted),
        },
      },
      { ids: ['alice', 'bob'] }
    );
    for (const row of snapshot['profile'] ?? []) {
      await device.run(
        sql`INSERT INTO profile (id, username, username_norm, deleted_at) VALUES (${String(row['id'])}, ${String(row['username'])}, ${row['username_norm'] as string | null}, ${String(row['deleted_at'])})`
      );
    }
    expect(
      await device.query(
        sql<{
          id: string;
        }>`SELECT id FROM profile WHERE username_norm IS NULL AND deleted_at IS NOT NULL ORDER BY id`
      )
    ).toEqual([{ id: 'alice' }, { id: 'bob' }]);
  } finally {
    await db.disconnect();
    await device.disconnect();
  }
});
