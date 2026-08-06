import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { sql } from '@pkgs/sql';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';

import { applyEnsuredUsername, ensureProfile } from './ensure-profile';

const MY_ID = '550e8400-e29b-41d4-a716-446655440000';

function rulesAuthFor(myId: string): AppRulesAuth {
  return {
    userId: myId,
    deviceId: myId,
    accountId: null,
    isAnon: true,
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
  // validatedWrite reads ps_crud watermarks (PowerSync queue); empty stub is enough.
  db.run(`
    CREATE TABLE ps_crud (
      id INTEGER PRIMARY KEY,
      tx_id INTEGER,
      data TEXT
    )
  `);
  return new SqlClientImplBunSqlite(db);
}

describe('ensureProfile', () => {
  test('creates a row with empty username and avatar', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient, rulesAuthFor(MY_ID), MY_ID);

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
    const auth = rulesAuthFor(MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);

    const rows = await sqlClient.query(sql<{ n: number }>`
      SELECT count(*) AS n
      FROM profiles
      WHERE id = ${MY_ID}
    `);
    expect(rows[0]?.n).toBe(1);
  });

  test('applyEnsuredUsername fills an empty local username', async () => {
    const sqlClient = openTestSql();
    const auth = rulesAuthFor(MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);
    await applyEnsuredUsername(sqlClient, auth, {
      profileId: MY_ID,
      username: 'AssignedName',
    });
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
    const auth = rulesAuthFor(MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);
    await applyEnsuredUsername(sqlClient, auth, {
      profileId: MY_ID,
      username: 'WrongOtherAccount',
    });
    await applyEnsuredUsername(sqlClient, auth, {
      profileId: MY_ID,
      username: 'CorrectName',
    });
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
    const auth = rulesAuthFor(MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);
    await sqlClient.run(sql<void>`
      UPDATE profiles
      SET username = ${'MyHandle'}, username_changed_at = ${new Date().toISOString()}
      WHERE id = ${MY_ID}
    `);
    await applyEnsuredUsername(sqlClient, auth, {
      profileId: MY_ID,
      username: 'ServerName',
    });
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
