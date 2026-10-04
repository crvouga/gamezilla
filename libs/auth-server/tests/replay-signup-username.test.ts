import { expect, test } from 'bun:test';
import { resolveReplayUsername } from '@libs/auth-shared/replay-username';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import sql from '@pkgs/sql-shared/sql';

test('an account chooses a username independently of its provider subject', async () => {
  // regression: signup-username-provider-subject
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(AUTH_TABLES));
    await db.run(
      sql`INSERT INTO auth_users (id, is_anon) VALUES (${'bob'}, ${false})`
    );
    await db.run(
      sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id) VALUES (${'google:bob'}, ${'bob'}, ${'google'}, ${'bob-gmail-com'})`
    );
    expect(await resolveReplayUsername(db, 'bob', 'bob')).toBe('bob');
    expect(await resolveReplayUsername(db, 'bob', undefined)).toBeUndefined();
    await db.run(
      sql`INSERT INTO auth_users (id, is_anon) VALUES (${'guest'}, ${true})`
    );
    expect(await resolveReplayUsername(db, 'guest', 'bob')).toBeUndefined();
    expect(await resolveReplayUsername(db, 'missing', 'bob')).toBeUndefined();
  } finally {
    await db.disconnect();
  }
});
