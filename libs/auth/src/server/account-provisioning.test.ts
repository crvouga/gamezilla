import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TABLE,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';

import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
  USERS_TABLE,
  UserTableCol,
} from '@libs/db/shared/external-accounts-tables';

import { ensureInternalAccountIdForExternalUser } from './account-provisioning';
import {
  findUserIdByPrimaryAuthExternalId,
  readExternalAccountId,
} from './external-accounts-sql';

function makeFakeAuthServer(
  snapshot: Record<string, unknown> | null
): AuthServerPort {
  return {
    providerLabel: PRIMARY_AUTH_PROVIDER,
    verifySessionToken: async () => null,
    getUserProfile: async () => null,
    getUserSnapshot: async () => snapshot,
  };
}

async function migrateAuthTables(sql: SqlClient): Promise<void> {
  await sql.run(
    `CREATE TABLE ${USERS_TABLE} (
      ${UserTableCol.id} TEXT PRIMARY KEY,
      ${UserTableCol.createdAt} TEXT NOT NULL
    )`
  );
  await sql.run(
    `CREATE TABLE ${EXTERNAL_ACCOUNTS_TABLE} (
      ${ExternalAccountCol.userId} TEXT NOT NULL,
      ${ExternalAccountCol.provider} TEXT NOT NULL,
      ${ExternalAccountCol.externalId} TEXT NOT NULL,
      ${ExternalAccountCol.metadata} TEXT NOT NULL DEFAULT '{}',
      ${ExternalAccountCol.createdAt} TEXT NOT NULL,
      PRIMARY KEY (${ExternalAccountCol.provider}, ${ExternalAccountCol.externalId}),
      UNIQUE (${ExternalAccountCol.userId}, ${ExternalAccountCol.provider})
    )`
  );
  await sql.run(
    `CREATE TABLE ${ENTITY_STORE_TABLE} (
      id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      owner_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (namespace, type, external_id)
    )`
  );
}

const EXTERNAL_USER_ID = 'user_external_2';
const PRIMARY_AUTH_PROVIDER = 'clerk';

describe('ensureInternalAccountIdForExternalUser', () => {
  let sql: SqlClient;

  beforeEach(async () => {
    sql = SqlClientImplBunSqlite.open(':memory:');
    await sql.connect();
    await migrateAuthTables(sql);
  });

  afterEach(async () => {
    await sql.disconnect();
  });

  test('returns existing user id for known clerk user', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const now = new Date().toISOString();
    await sql.run(
      `INSERT INTO ${USERS_TABLE} (${UserTableCol.id}, ${UserTableCol.createdAt})
       VALUES (?, ?)`,
      [userId, now]
    );
    await sql.run(
      `INSERT INTO ${EXTERNAL_ACCOUNTS_TABLE}
       (${ExternalAccountCol.userId}, ${ExternalAccountCol.provider},
        ${ExternalAccountCol.externalId}, ${ExternalAccountCol.metadata},
        ${ExternalAccountCol.createdAt})
       VALUES (?, ?, ?, ?, ?)`,
      [userId, PRIMARY_AUTH_PROVIDER, EXTERNAL_USER_ID, '{}', now]
    );

    const resolved = await ensureInternalAccountIdForExternalUser({
      sql,
      authServer: makeFakeAuthServer(null),
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(resolved).toBe(userId);
  });

  test('creates user, clerk external_account row, and entity_store snapshot', async () => {
    const resolved = await ensureInternalAccountIdForExternalUser({
      sql,
      authServer: makeFakeAuthServer({ id: EXTERNAL_USER_ID, email: 'a@b.c' }),
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(
      await findUserIdByPrimaryAuthExternalId(
        sql,
        PRIMARY_AUTH_PROVIDER,
        EXTERNAL_USER_ID
      )
    ).toBe(resolved);
    expect(
      await readExternalAccountId(sql, resolved, PRIMARY_AUTH_PROVIDER)
    ).toBe(EXTERNAL_USER_ID);

    const entityRows = await sql.query<{ owner_id: string | null }>(
      `SELECT owner_id FROM ${ENTITY_STORE_TABLE}
       WHERE namespace = ? AND type = ? AND external_id = ?`,
      [ENTITY_STORE_NAMESPACE_AUTH, ENTITY_STORE_TYPE_USER, EXTERNAL_USER_ID]
    );
    expect(entityRows[0]?.owner_id).toBe(resolved);
  });
});
