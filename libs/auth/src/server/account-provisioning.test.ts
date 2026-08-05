import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  ENTITY_STORE_NAMESPACE_AUTH,
  ENTITY_STORE_TYPE_USER,
} from '@libs/db/shared/entity-store-table';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

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
  await db.run(sql<void>`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE external_accounts (
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      PRIMARY KEY (provider, external_id),
      UNIQUE (user_id, provider)
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE entity_store (
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
    await sqlClient.run(sql<void>`
      INSERT INTO users (id, created_at)
      VALUES (${userId}, ${now})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO external_accounts (
        user_id,
        provider,
        external_id,
        metadata,
        created_at
      )
      VALUES (
        ${userId},
        ${PRIMARY_AUTH_PROVIDER},
        ${EXTERNAL_USER_ID},
        ${'{}'},
        ${now}
      )
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

    const entityRows = await sqlClient.query(sql<{ owner_id: string | null }>`
      SELECT owner_id
      FROM entity_store
      WHERE namespace = ${ENTITY_STORE_NAMESPACE_AUTH}
        AND type = ${ENTITY_STORE_TYPE_USER}
        AND external_id = ${EXTERNAL_USER_ID}
    `);
    expect(entityRows[0]?.owner_id).toBe(resolved);
  });

  test('repeated ensures resolve to the same account id and single link', async () => {
    // Bun SQLite shares one connection — overlapping BEGIN fails — so this
    // asserts idempotency + single link. Race adoption is covered by
    // insertExternalAccountOrGet + the adopt-existing test below; Postgres
    // serializes concurrent callers via pg_advisory_xact_lock.
    const authServer = makeFakeAuthServer({
      id: EXTERNAL_USER_ID,
      email: 'a@b.c',
    });
    const a = await ensureInternalAccountIdForExternalUser({
      sql: sqlClient,
      authServer,
      externalUserId: EXTERNAL_USER_ID,
    });
    const b = await ensureInternalAccountIdForExternalUser({
      sql: sqlClient,
      authServer,
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(a).toBe(b);
    expect(
      await findUserIdByPrimaryAuthExternalId(
        sqlClient,
        PRIMARY_AUTH_PROVIDER,
        EXTERNAL_USER_ID
      )
    ).toBe(a);

    const linkRows = await sqlClient.query(sql<{ user_id: string }>`
      SELECT user_id
      FROM external_accounts
      WHERE provider = ${PRIMARY_AUTH_PROVIDER}
        AND external_id = ${EXTERNAL_USER_ID}
    `);
    expect(linkRows).toHaveLength(1);
    expect(linkRows[0]?.user_id).toBe(a);
  });

  test('adopts existing link when a candidate insert loses the race', async () => {
    const winnerId = '33333333-3333-4333-8333-333333333333';
    const now = new Date().toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO users (id, created_at)
      VALUES (${winnerId}, ${now})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO external_accounts (
        user_id,
        provider,
        external_id,
        metadata,
        created_at
      )
      VALUES (
        ${winnerId},
        ${PRIMARY_AUTH_PROVIDER},
        ${EXTERNAL_USER_ID},
        ${'{}'},
        ${now}
      )
    `);

    const resolved = await ensureInternalAccountIdForExternalUser({
      sql: sqlClient,
      authServer: makeFakeAuthServer({ id: EXTERNAL_USER_ID }),
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(resolved).toBe(winnerId);
  });
});
