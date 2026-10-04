import { expect, test } from 'bun:test';
import { profileRowByIdSql } from '@libs/profile-shared/profile-row-sql';
import { ProfileReadRepository } from '@libs/profile-shared/read-profile';
import { PROFILE_TABLES } from '@libs/profile-shared/tables';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-shared/sql';

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
