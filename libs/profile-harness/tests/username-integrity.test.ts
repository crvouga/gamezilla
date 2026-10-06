import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import {
  createAppModeration,
  SHIPPED_TEAM_RULES,
} from '@libs/moderation-shared/policy';
import { PROFILE_TABLES } from '@libs/profile-shared/tables';
import { validateUsername } from '@libs/profile-shared/username';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';

const moderation = createAppModeration(SHIPPED_TEAM_RULES);

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
    expect(validateUsername('fuck', moderation)).toBe('blocked');
    expect(validateUsername('FuCk3r', moderation)).toBe('blocked');
    expect(validateUsername('fuuuck', moderation)).toBe('blocked');
    expect(validateUsername('n1gga', moderation)).toBe('blocked');
  });

  test('accepts ordinary usernames', () => {
    expect(validateUsername('BraveTiger482', moderation)).toBeNull();
    expect(validateUsername('alice', moderation)).toBeNull();
  });
});
