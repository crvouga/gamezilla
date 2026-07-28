import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import { honey } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { WriteContext } from '@pkgs/write/shared/write-context';

import { applyEnsuredUsername, ensureProfile } from './ensure-profile';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';

const MY_ID = '550e8400-e29b-41d4-a716-446655440000';

function writeContextFor(myId: string): WriteContext {
  return {
    subjectId: myId,
    deviceId: myId,
    accountId: null,
    myId,
    isAnonymous: true,
    memberOfSpaceIds: [],
  };
}

function openTestSql(): SqlClientImplBunSqlite {
  const db = new Database(':memory:');
  db.run(
    `CREATE TABLE ${PROFILES_TABLE.tableName} (
      ${ProfileCol.id} TEXT PRIMARY KEY,
      ${ProfileCol.createdAt} TEXT NOT NULL,
      ${ProfileCol.username} TEXT NOT NULL DEFAULT '',
      ${ProfileCol.usernameChangedAt} TEXT,
      ${ProfileCol.avatarConfig} TEXT NOT NULL
    )`
  );
  return new SqlClientImplBunSqlite(db);
}

describe('ensureProfile', () => {
  test('creates a row with empty username and avatar', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient, writeContextFor(MY_ID), MY_ID);

    const row = (
      await sqlClient.query<Record<string, string>>(
        honey({
          select: [
            [ProfileCol.username, 'username'],
            [ProfileCol.avatarConfig, 'avatar_config'],
          ],
          from: PROFILES_TABLE.tableName,
          where: ['=', ProfileCol.id, MY_ID],
        })
      )
    )[0];

    expect(row?.['username']).toBe('');
    expect(row?.['avatar_config']?.length ?? 0).toBeGreaterThan(0);
  });

  test('does not insert a second row when profile already exists', async () => {
    const sqlClient = openTestSql();
    const ctx = writeContextFor(MY_ID);
    await ensureProfile(sqlClient, ctx, MY_ID);
    await ensureProfile(sqlClient, ctx, MY_ID);

    const rows = await sqlClient.query<{ n: number }>(
      honey({
        select: [[['count', '*'], 'n']],
        from: PROFILES_TABLE.tableName,
        where: ['=', ProfileCol.id, MY_ID],
      })
    );
    expect(rows[0]?.n).toBe(1);
  });

  test('applyEnsuredUsername fills an empty local username', async () => {
    const sqlClient = openTestSql();
    const ctx = writeContextFor(MY_ID);
    await ensureProfile(sqlClient, ctx, MY_ID);
    await applyEnsuredUsername(sqlClient, ctx, {
      profileId: MY_ID,
      username: 'AssignedName',
    });
    const row = (
      await sqlClient.query<Record<string, string>>(
        honey({
          select: [[ProfileCol.username, 'username']],
          from: PROFILES_TABLE.tableName,
          where: ['=', ProfileCol.id, MY_ID],
        })
      )
    )[0];
    expect(row?.['username']).toBe('AssignedName');
  });

  test('applyEnsuredUsername corrects wrong auto username', async () => {
    const sqlClient = openTestSql();
    const ctx = writeContextFor(MY_ID);
    await ensureProfile(sqlClient, ctx, MY_ID);
    await applyEnsuredUsername(sqlClient, ctx, {
      profileId: MY_ID,
      username: 'WrongOtherAccount',
    });
    await applyEnsuredUsername(sqlClient, ctx, {
      profileId: MY_ID,
      username: 'CorrectName',
    });
    const row = (
      await sqlClient.query<Record<string, string>>(
        honey({
          select: [[ProfileCol.username, 'username']],
          from: PROFILES_TABLE.tableName,
          where: ['=', ProfileCol.id, MY_ID],
        })
      )
    )[0];
    expect(row?.['username']).toBe('CorrectName');
  });

  test('applyEnsuredUsername does not overwrite user-chosen username', async () => {
    const sqlClient = openTestSql();
    const ctx = writeContextFor(MY_ID);
    await ensureProfile(sqlClient, ctx, MY_ID);
    await sqlClient.run(
      honey({
        update: PROFILES_TABLE.tableName,
        set: {
          [ProfileCol.username]: 'MyHandle',
          [ProfileCol.usernameChangedAt]: new Date().toISOString(),
        },
        where: ['=', ProfileCol.id, MY_ID],
      })
    );
    await applyEnsuredUsername(sqlClient, ctx, {
      profileId: MY_ID,
      username: 'ServerName',
    });
    const row = (
      await sqlClient.query<Record<string, string>>(
        honey({
          select: [[ProfileCol.username, 'username']],
          from: PROFILES_TABLE.tableName,
          where: ['=', ProfileCol.id, MY_ID],
        })
      )
    )[0];
    expect(row?.['username']).toBe('MyHandle');
  });
});
