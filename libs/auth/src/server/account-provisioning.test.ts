import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { sql, ident } from '@pkgs/sql';
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

async function migrateAuthTables(db: SqlClient): Promise<void> {
  await db.run(sql`
    CREATE TABLE ${ident(USERS_TABLE)} (
      ${ident(UserTableCol.id)} TEXT PRIMARY KEY,
      ${ident(UserTableCol.createdAt)} TEXT NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE ${ident(EXTERNAL_ACCOUNTS_TABLE)} (
      ${ident(ExternalAccountCol.userId)} TEXT NOT NULL,
      ${ident(ExternalAccountCol.provider)} TEXT NOT NULL,
      ${ident(ExternalAccountCol.externalId)} TEXT NOT NULL,
      ${ident(ExternalAccountCol.metadata)} TEXT NOT NULL DEFAULT '{}',
      ${ident(ExternalAccountCol.createdAt)} TEXT NOT NULL,
      PRIMARY KEY (${ident(ExternalAccountCol.provider)}, ${ident(ExternalAccountCol.externalId)}),
      UNIQUE (${ident(ExternalAccountCol.userId)}, ${ident(ExternalAccountCol.provider)})
    )
  `);
  await db.run(sql`
    CREATE TABLE ${ident(ENTITY_STORE_TABLE)} (
      id TEXT PRIMARY KEY,
      namespace TEXT NOT NULL,
      type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      owner_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (namespace, type, external_id)
    )
  `);
}

const EXTERNAL_USER_ID = 'user_external_2';
const PRIMARY_AUTH_PROVIDER = 'clerk';

describe('ensureInternalAccountIdForExternalUser', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrateAuthTables(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('returns existing user id for known clerk user', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const now = new Date().toISOString();
    await sqlClient.run(sql`
      INSERT INTO ${ident(USERS_TABLE)} (${ident(UserTableCol.id)}, ${ident(UserTableCol.createdAt)})
      VALUES (${userId}, ${now})
    `);
    await sqlClient.run(sql`
      INSERT INTO ${ident(EXTERNAL_ACCOUNTS_TABLE)}
      (${ident(ExternalAccountCol.userId)}, ${ident(ExternalAccountCol.provider)},
       ${ident(ExternalAccountCol.externalId)}, ${ident(ExternalAccountCol.metadata)},
       ${ident(ExternalAccountCol.createdAt)})
      VALUES (${userId}, ${PRIMARY_AUTH_PROVIDER}, ${EXTERNAL_USER_ID}, '{}', ${now})
    `);

    const resolved = await ensureInternalAccountIdForExternalUser({
      sql: sqlClient,
      authServer: makeFakeAuthServer(null),
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(resolved).toBe(userId);
  });

  test('creates user, clerk external_account row, and entity_store snapshot', async () => {
    const resolved = await ensureInternalAccountIdForExternalUser({
      sql: sqlClient,
      authServer: makeFakeAuthServer({ id: EXTERNAL_USER_ID, email: 'a@b.c' }),
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(
      await findUserIdByPrimaryAuthExternalId(
        sqlClient,
        PRIMARY_AUTH_PROVIDER,
        EXTERNAL_USER_ID
      )
    ).toBe(resolved);
    expect(
      await readExternalAccountId(sqlClient, resolved, PRIMARY_AUTH_PROVIDER)
    ).toBe(EXTERNAL_USER_ID);

    const entityRows = await sqlClient.query<{ owner_id: string | null }>(sql`
      SELECT owner_id FROM ${ident(ENTITY_STORE_TABLE)}
      WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH} AND type = ${ENTITY_STORE_TYPE_USER} AND external_id = ${EXTERNAL_USER_ID}
    `);
    expect(entityRows[0]?.owner_id).toBe(resolved);
  });
});
