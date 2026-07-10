import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';

import { ensureProfile } from './ensure-profile-entity';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

const MY_ID = '550e8400-e29b-41d4-a716-446655440000';

function openTestSql(): SqlClientImplBunSqlite {
  const db = new Database(':memory:');
  db.run(
    `CREATE TABLE ${PROFILES_TABLE.tableName} (
      ${ProfileCol.id} TEXT PRIMARY KEY,
      ${ProfileCol.createdAt} TEXT NOT NULL,
      ${ProfileCol.displayName} TEXT NOT NULL,
      ${ProfileCol.avatarConfig} TEXT NOT NULL
    )`
  );
  return new SqlClientImplBunSqlite(db);
}

describe('ensureProfile', () => {
  test('creates a deterministic display name for the same myId', async () => {
    const sqlA = openTestSql();
    const sqlB = openTestSql();
    await ensureProfile(sqlA, MY_ID);
    await ensureProfile(sqlB, MY_ID);

    const rowA = (
      await sqlA.query<Record<string, string>>(
        `SELECT ${ProfileCol.displayName} AS display_name FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ?`,
        [MY_ID]
      )
    )[0];
    const rowB = (
      await sqlB.query<Record<string, string>>(
        `SELECT ${ProfileCol.displayName} AS display_name FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ?`,
        [MY_ID]
      )
    )[0];

    expect(rowA?.['display_name']).toBe(rowB?.['display_name']);
    expect((rowA?.['display_name']?.length ?? 0)).toBeGreaterThan(0);
  });

  test('does not insert a second row when profile already exists', async () => {
    const sql = openTestSql();
    await ensureProfile(sql, MY_ID);
    await ensureProfile(sql, MY_ID);

    const rows = await sql.query<{ n: number }>(
      `SELECT count(*) AS n FROM ${PROFILES_TABLE.tableName} WHERE ${ProfileCol.id} = ?`,
      [MY_ID]
    );
    expect(rows[0]?.n).toBe(1);
  });
});
