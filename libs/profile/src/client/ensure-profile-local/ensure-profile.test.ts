import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { sql } from '@pkgs/sql';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import {
  applyEnsuredUsernameMutation,
  ensureProfileMutation,
} from '../../shared/mutations/profile-mutations';

const MY_ID = '550e8400-e29b-41d4-a716-446655440000';

function mutationEnv(myId: string) {
  return {
    actorId: myId,
    deviceId: myId,
    accountId: null,
    isAnon: true,
    now: () => new Date('2026-08-06T00:00:00.000Z'),
  };
}

function openTestSql(): SqlClientImplBunSqlite {
  const db = new Database(':memory:');
  db.run(`
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      username_changed_at TEXT,
      avatar_config TEXT NOT NULL
    )
  `);
  return new SqlClientImplBunSqlite(db);
}

async function ensureProfile(sqlClient: SqlClientImplBunSqlite): Promise<void> {
  await ensureProfileMutation.run(
    { tx: sqlClient, env: mutationEnv(MY_ID) },
    {}
  );
}

async function applyEnsuredUsername(
  sqlClient: SqlClientImplBunSqlite,
  username: string
): Promise<void> {
  await applyEnsuredUsernameMutation.run(
    { tx: sqlClient, env: mutationEnv(MY_ID) },
    { username }
  );
}

describe('ensureProfile', () => {
  test('creates a row with empty username and avatar', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient);

    const row = (
      await sqlClient.query(sql<Record<string, string>>`
        SELECT username, avatar_config
        FROM profiles
        WHERE id = ${MY_ID}
      `)
    )[0];

    expect(row?.['username']).toBe('');
    expect(row?.['avatar_config']?.length ?? 0).toBeGreaterThan(0);
  });

  test('does not insert a second row when profile already exists', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient);
    await ensureProfile(sqlClient);

    const rows = await sqlClient.query(sql<{ n: number }>`
      SELECT count(*) AS n
      FROM profiles
      WHERE id = ${MY_ID}
    `);
    expect(rows[0]?.n).toBe(1);
  });

  test('applyEnsuredUsername fills an empty local username', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient);
    await applyEnsuredUsername(sqlClient, 'AssignedName');
    const row = (
      await sqlClient.query(sql<Record<string, string>>`
        SELECT username
        FROM profiles
        WHERE id = ${MY_ID}
      `)
    )[0];
    expect(row?.['username']).toBe('AssignedName');
  });

  test('applyEnsuredUsername corrects wrong auto username', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient);
    await applyEnsuredUsername(sqlClient, 'WrongOtherAccount');
    await applyEnsuredUsername(sqlClient, 'CorrectName');
    const row = (
      await sqlClient.query(sql<Record<string, string>>`
        SELECT username
        FROM profiles
        WHERE id = ${MY_ID}
      `)
    )[0];
    expect(row?.['username']).toBe('CorrectName');
  });

  test('applyEnsuredUsername does not overwrite user-chosen username', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient);
    await sqlClient.run(sql<void>`
      UPDATE profiles
      SET username = ${'MyHandle'}, username_changed_at = ${new Date().toISOString()}
      WHERE id = ${MY_ID}
    `);
    await applyEnsuredUsername(sqlClient, 'ServerName');
    const row = (
      await sqlClient.query(sql<Record<string, string>>`
        SELECT username
        FROM profiles
        WHERE id = ${MY_ID}
      `)
    )[0];
    expect(row?.['username']).toBe('MyHandle');
  });
});
