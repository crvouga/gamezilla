import { beforeEach, describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import {
  actorVisibleLiveSpacesPredicateSql,
  actorVisibleSpacesPredicateSql,
} from './actor-visible-spaces-sql';

const ACCOUNT_ID = 'account-bbbbbbbb-1111';
const OTHER_ACCOUNT = 'account-other-cccc-2222';
const FRIEND_HOST_SPACE = 'space-friend-host-1';
const ENDED_FRIEND_SPACE = 'space-friend-ended-1';

function openSql(): SqlClientImplBunSqlite {
  return SqlClientImplBunSqlite.open(':memory:');
}

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE spaces (
      id TEXT PRIMARY KEY,
      title TEXT,
      host_id TEXT,
      created_at TEXT,
      ended_at TEXT,
      visibility TEXT,
      host_account_id TEXT,
      host_member_id TEXT,
      deleted_at TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE spaces_users (
      id TEXT PRIMARY KEY,
      space_id TEXT,
      user_id TEXT,
      created_at TEXT,
      created_by_account_id TEXT,
      deleted_at TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE friends_friendships (
      id TEXT PRIMARY KEY,
      user_low TEXT,
      user_high TEXT,
      deleted_at TEXT,
      created_at TEXT
    )
  `);
}

async function seedSpace(
  db: SqlClient,
  args: {
    readonly id: string;
    readonly hostAccountId: string;
    readonly endedAt: string | null;
    readonly createdAt: string;
  }
): Promise<void> {
  await db.run(sql<void>`
    INSERT INTO spaces (
      id, host_id, host_member_id, host_account_id, visibility, ended_at, created_at
    )
    VALUES (
      ${args.id},
      'device-aaaaaaaa-0000',
      ${args.hostAccountId},
      ${args.hostAccountId},
      'private',
      ${args.endedAt},
      ${args.createdAt}
    )
  `);
}

describe('actor-visible-spaces-sql', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
    await db.run(sql<void>`
      INSERT INTO friends_friendships (id, user_low, user_high, deleted_at, created_at)
      VALUES ('friendship-1', ${ACCOUNT_ID}, ${OTHER_ACCOUNT}, ${null}, ${'2026-01-01T00:00:00.000Z'})
    `);
  });

  test('hydrate predicate includes live friend-hosted space', async () => {
    await seedSpace(db, {
      id: FRIEND_HOST_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      endedAt: null,
      createdAt: '2026-01-04T00:00:00.000Z',
    });

    const visible = actorVisibleSpacesPredicateSql(ACCOUNT_ID);
    const rows = await db.query(sql<{ readonly id: string }>`
      SELECT id FROM spaces WHERE ${visible}
    `);
    expect(rows.map((r) => r.id)).toContain(FRIEND_HOST_SPACE);
  });

  test('hydrate predicate includes ended friend-hosted space (tombstones sync)', async () => {
    await seedSpace(db, {
      id: ENDED_FRIEND_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      endedAt: '2026-01-02T01:00:00.000Z',
      createdAt: '2026-01-04T00:00:00.000Z',
    });

    const visible = actorVisibleSpacesPredicateSql(ACCOUNT_ID);
    const rows = await db.query(sql<{ readonly id: string }>`
      SELECT id FROM spaces WHERE ${visible}
    `);
    expect(rows.map((r) => r.id)).toContain(ENDED_FRIEND_SPACE);
  });

  test('live predicate excludes ended friend-hosted space', async () => {
    await seedSpace(db, {
      id: ENDED_FRIEND_SPACE,
      hostAccountId: OTHER_ACCOUNT,
      endedAt: '2026-01-02T01:00:00.000Z',
      createdAt: '2026-01-04T00:00:00.000Z',
    });

    const visible = actorVisibleLiveSpacesPredicateSql(ACCOUNT_ID);
    const rows = await db.query(sql<{ readonly id: string }>`
      SELECT id FROM spaces WHERE ${visible}
    `);
    expect(rows.map((r) => r.id)).not.toContain(ENDED_FRIEND_SPACE);
  });
});
