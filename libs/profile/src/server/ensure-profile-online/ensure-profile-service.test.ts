import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { ProfileError } from '../../shared/profile-errors';
import { ensureProfileWithUsername } from './ensure-profile-service';

const ACCOUNT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      avatar_config TEXT
    )
  `);
}

describe('ensureProfileWithUsername', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrate(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('requireUserRow rejects when users row is missing', async () => {
    await expect(
      ensureProfileWithUsername(sqlClient, ACCOUNT_ID, {
        requireUserRow: true,
      })
    ).rejects.toBeInstanceOf(ProfileError);

    const profiles = await sqlClient.query(sql<{ id: string }>`
      SELECT id FROM profiles
    `);
    expect(profiles).toHaveLength(0);
  });

  test('requireUserRow creates profile when users row exists', async () => {
    const now = new Date().toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO users (id, created_at)
      VALUES (${ACCOUNT_ID}, ${now})
    `);

    const card = await ensureProfileWithUsername(sqlClient, ACCOUNT_ID, {
      requireUserRow: true,
    });

    expect(card.userId).toBe(ACCOUNT_ID);
    expect(card.username.length).toBeGreaterThan(0);
  });

  test('anon path can create without users row', async () => {
    const card = await ensureProfileWithUsername(sqlClient, DEVICE_ID);
    expect(card.userId).toBe(DEVICE_ID);
    expect(card.username.length).toBeGreaterThan(0);
  });
});
