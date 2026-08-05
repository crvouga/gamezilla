import { beforeEach, describe, expect, test } from 'bun:test';

import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import {
  closeEndedSpaceSessions,
  closeSpaceSession,
  markSpaceSessionJoinAnnounced,
  openSpaceSession,
} from './space-open-session-write';

function openSql(): SqlClientImplBunSqlite {
  return SqlClientImplBunSqlite.open(':memory:');
}

async function migrate(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    CREATE TABLE spaces (
      id TEXT PRIMARY KEY,
      ended_at TEXT
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE local_space_open_sessions (
      id TEXT PRIMARY KEY,
      opened_at TEXT,
      client_id TEXT,
      join_announced INTEGER
    )
  `);
}

describe('space-open-session-write', () => {
  let db: SqlClientImplBunSqlite;

  beforeEach(async () => {
    db = openSql();
    await migrate(db);
  });

  test('openSpaceSession inserts once and keeps client_id', async () => {
    await openSpaceSession(db, 'space-1');
    const first = await db.query(sql<{ client_id: string }>`
      SELECT client_id FROM local_space_open_sessions WHERE id = ${'space-1'}
    `);
    await openSpaceSession(db, 'space-1');
    const second = await db.query(sql<{ client_id: string }>`
      SELECT client_id FROM local_space_open_sessions WHERE id = ${'space-1'}
    `);
    expect(first[0]?.client_id).toBeTruthy();
    expect(second[0]?.client_id).toBe(first[0]?.client_id);
  });

  test('closeSpaceSession removes the row', async () => {
    await openSpaceSession(db, 'space-1');
    await closeSpaceSession(db, 'space-1');
    const rows = await db.query(sql<{ id: string }>`
      SELECT id FROM local_space_open_sessions
    `);
    expect(rows).toEqual([]);
  });

  test('closeEndedSpaceSessions drops sessions for ended spaces', async () => {
    await openSpaceSession(db, 'live');
    await openSpaceSession(db, 'ended');
    await db.run(sql<void>`
      INSERT INTO spaces (id, ended_at) VALUES (${'live'}, NULL)
    `);
    await db.run(sql<void>`
      INSERT INTO spaces (id, ended_at)
      VALUES (${'ended'}, ${'2026-01-02T00:00:00.000Z'})
    `);
    await closeEndedSpaceSessions(db);
    const rows = await db.query(sql<{ id: string }>`
      SELECT id FROM local_space_open_sessions ORDER BY id
    `);
    expect(rows.map((r) => r.id)).toEqual(['live']);
  });

  test('markSpaceSessionJoinAnnounced is once-only', async () => {
    await openSpaceSession(db, 'space-1');
    expect(await markSpaceSessionJoinAnnounced(db, 'space-1')).toBe(true);
    expect(await markSpaceSessionJoinAnnounced(db, 'space-1')).toBe(false);
  });
});
