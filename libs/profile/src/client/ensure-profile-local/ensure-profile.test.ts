import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';

import { sqlMap } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { RulesAuth } from '@pkgs/rules/core/types';

import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import { applyEnsuredUsername, ensureProfile } from './ensure-profile';

const MY_ID = '550e8400-e29b-41d4-a716-446655440000';

function rulesAuthFor(myId: string): RulesAuth {
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
  // validatedWrite reads ps_crud watermarks (PowerSync queue); empty stub is enough.
  db.run(
    `CREATE TABLE ps_crud (
      id INTEGER PRIMARY KEY,
      tx_id INTEGER,
      data TEXT
    )`
  );
  return new SqlClientImplBunSqlite(db);
}

describe('ensureProfile', () => {
  test('creates a row with empty username and avatar', async () => {
    const sqlClient = openTestSql();
    await ensureProfile(sqlClient, rulesAuthFor(MY_ID), MY_ID);

    const row = (
      await sqlClient.query<Record<string, string>>(
        sqlMap({
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
    const auth = rulesAuthFor(MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);

    const rows = await sqlClient.query<{ n: number }>(
      sqlMap({
        select: [[['count', '*'], 'n']],
        from: PROFILES_TABLE.tableName,
        where: ['=', ProfileCol.id, MY_ID],
      })
    );
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
      await sqlClient.query<Record<string, string>>(
        sqlMap({
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
      await sqlClient.query<Record<string, string>>(
        sqlMap({
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
    const auth = rulesAuthFor(MY_ID);
    await ensureProfile(sqlClient, auth, MY_ID);
    await sqlClient.run(
      sqlMap({
        update: PROFILES_TABLE.tableName,
        set: {
          [ProfileCol.username]: 'MyHandle',
          [ProfileCol.usernameChangedAt]: new Date().toISOString(),
        },
        where: ['=', ProfileCol.id, MY_ID],
      })
    );
    await applyEnsuredUsername(sqlClient, auth, {
      profileId: MY_ID,
      username: 'ServerName',
    });
    const row = (
      await sqlClient.query<Record<string, string>>(
        sqlMap({
          select: [[ProfileCol.username, 'username']],
          from: PROFILES_TABLE.tableName,
          where: ['=', ProfileCol.id, MY_ID],
        })
      )
    )[0];
    expect(row?.['username']).toBe('MyHandle');
  });
});
