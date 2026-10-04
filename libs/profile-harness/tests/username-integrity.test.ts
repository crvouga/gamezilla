import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { PROFILE_TABLES } from '@libs/profile-shared/tables';
import { validateUsername } from '@libs/profile-shared/username';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-server/impl-bun-sqlite';
import sql from '@pkgs/sql-shared/sql';

async function openProfileDb() {
  const client = new SqlClientImplBunSqlite(new Database(':memory:'));
  await reconcileSqliteSchema(client, registerTables(PROFILE_TABLES));
  return client;
}

describe('profile username uniqueness', () => {
  test('the database refuses a second live profile with the same username', async () => {
    const client = await openProfileDb();
    await client.run(sql<void>`
      INSERT INTO profile (id, created_at, username, username_norm, avatar_config)
      VALUES ('p1', '2026-01-01T00:00:00.000Z', 'Alice', 'alice', '{}')
    `);
    await expect(
      client.run(sql<void>`
        INSERT INTO profile (id, created_at, username, username_norm, avatar_config)
        VALUES ('p2', '2026-01-01T00:00:00.000Z', 'Alice', 'alice', '{}')
      `)
    ).rejects.toThrow();
  });

  test('profiles without a claimed username (NULL norm) do not collide', async () => {
    const client = await openProfileDb();
    await client.run(sql<void>`
      INSERT INTO profile (id, created_at, username, username_norm, avatar_config)
      VALUES ('p1', '2026-01-01T00:00:00.000Z', '', NULL, '{}')
    `);
    await client.run(sql<void>`
      INSERT INTO profile (id, created_at, username, username_norm, avatar_config)
      VALUES ('p2', '2026-01-01T00:00:00.000Z', '', NULL, '{}')
    `);
    const rows = await client.query<{ readonly id: string }>(sql`
      SELECT id FROM profile WHERE username_norm IS NULL ORDER BY id
    `);
    expect(rows.map((r) => r.id)).toEqual(['p1', 'p2']);
  });
});

describe('username content filter', () => {
  test('refuses slurs and leetspeak disguises', () => {
    expect(validateUsername('fuck')).toBe('blocked');
    expect(validateUsername('FuCk3r')).toBe('blocked');
    expect(validateUsername('fuuuck')).toBe('blocked');
    expect(validateUsername('n1gga')).toBe('blocked');
  });

  test('accepts ordinary usernames', () => {
    expect(validateUsername('BraveTiger482')).toBeNull();
    expect(validateUsername('alice')).toBeNull();
  });
});
