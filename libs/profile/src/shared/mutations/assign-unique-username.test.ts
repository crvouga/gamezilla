import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { MutationError } from '@pkgs/sync-engine/shared';

import { generateRandomUsername } from '../username-generator';
import { assignUniqueUsernameIfEmpty } from './assign-unique-username';
import { ensureProfileMutation } from './profile-mutations';

const ACCOUNT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW_ISO = '2026-08-06T00:00:00.000Z';

function mutationEnv(myId: string) {
  return {
    actorId: myId,
    deviceId: myId,
    accountId: null,
    isAnon: true,
    now: () => new Date('2026-08-06T00:00:00.000Z'),
    createId: () => myId,
  };
}

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      username_norm TEXT NOT NULL DEFAULT '',
      username_changed_at TEXT,
      avatar_config TEXT
    )
  `);
}

describe('assignUniqueUsernameIfEmpty', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrate(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('assigns a username when empty', async () => {
    const now = NOW_ISO;
    await sqlClient.run(sql<void>`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${ACCOUNT_ID}, ${now}, ${''}, ${''}, ${'{}'})
    `);

    await assignUniqueUsernameIfEmpty(sqlClient, ACCOUNT_ID);

    const rows = await sqlClient.query(sql<{ username: string }>`
      SELECT username FROM profiles WHERE id = ${ACCOUNT_ID}
    `);
    expect(rows[0]?.username.length).toBeGreaterThan(0);
  });

  test('leaves an existing username alone', async () => {
    const now = NOW_ISO;
    await sqlClient.run(sql<void>`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${ACCOUNT_ID}, ${now}, ${'AlreadyTaken'}, ${'alreadytaken'}, ${'{}'})
    `);

    await assignUniqueUsernameIfEmpty(sqlClient, ACCOUNT_ID);

    const rows = await sqlClient.query(sql<{ username: string }>`
      SELECT username FROM profiles WHERE id = ${ACCOUNT_ID}
    `);
    expect(rows[0]?.username).toBe('AlreadyTaken');
  });

  test('skips colliding generated names', async () => {
    const now = NOW_ISO;
    const collision = generateRandomUsername(`${ACCOUNT_ID}:0`);
    await sqlClient.run(sql<void>`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${OTHER_ID}, ${now}, ${collision}, ${collision.toLowerCase()}, ${'{}'})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${ACCOUNT_ID}, ${now}, ${''}, ${''}, ${'{}'})
    `);

    await assignUniqueUsernameIfEmpty(sqlClient, ACCOUNT_ID);

    const rows = await sqlClient.query(sql<{ username: string }>`
      SELECT username FROM profiles WHERE id = ${ACCOUNT_ID}
    `);
    expect(rows[0]?.username).toBe(generateRandomUsername(`${ACCOUNT_ID}:1`));
    expect(rows[0]?.username).not.toBe(collision);
  });

  test('throws when every attempt collides', async () => {
    const now = NOW_ISO;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const username = generateRandomUsername(`${ACCOUNT_ID}:${attempt}`);
      await sqlClient.run(sql<void>`
        INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
        VALUES (${`${OTHER_ID}-${attempt}`}, ${now}, ${username}, ${username.toLowerCase()}, ${'{}'})
      `);
    }
    await sqlClient.run(sql<void>`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${ACCOUNT_ID}, ${now}, ${''}, ${''}, ${'{}'})
    `);

    await expect(
      assignUniqueUsernameIfEmpty(sqlClient, ACCOUNT_ID)
    ).rejects.toBeInstanceOf(MutationError);
  });
});

describe('ensureProfileMutation', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrate(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('creates a row with an auto-assigned username and avatar', async () => {
    await ensureProfileMutation.run(
      { tx: sqlClient, env: mutationEnv(ACCOUNT_ID) },
      {}
    );

    const row = (
      await sqlClient.query(sql<Record<string, string>>`
        SELECT username, avatar_config
        FROM profiles
        WHERE id = ${ACCOUNT_ID}
      `)
    )[0];

    expect(row?.['username']?.length ?? 0).toBeGreaterThan(0);
    expect(row?.['avatar_config']?.length ?? 0).toBeGreaterThan(0);
  });

  test('does not insert a second row when profile already exists', async () => {
    await ensureProfileMutation.run(
      { tx: sqlClient, env: mutationEnv(ACCOUNT_ID) },
      {}
    );
    await ensureProfileMutation.run(
      { tx: sqlClient, env: mutationEnv(ACCOUNT_ID) },
      {}
    );

    const rows = await sqlClient.query(sql<{ n: number }>`
      SELECT count(*) AS n
      FROM profiles
      WHERE id = ${ACCOUNT_ID}
    `);
    expect(rows[0]?.n).toBe(1);
  });

  test('fills empty username on an existing row', async () => {
    const now = NOW_ISO;
    await sqlClient.run(sql<void>`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${ACCOUNT_ID}, ${now}, ${''}, ${''}, ${'{"seed":"x"}'})
    `);

    await ensureProfileMutation.run(
      { tx: sqlClient, env: mutationEnv(ACCOUNT_ID) },
      {}
    );

    const rows = await sqlClient.query(sql<{ username: string }>`
      SELECT username FROM profiles WHERE id = ${ACCOUNT_ID}
    `);
    expect(rows[0]?.username.length).toBeGreaterThan(0);
  });
});
