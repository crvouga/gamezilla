import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import { createSimIo } from '@pkgs/io';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { AccountProvisioningService } from './account-provisioning';
import { ExternalAccountRepository } from './external-account-repository';

const io = createSimIo({ seed: 1 });

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
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      is_anon INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.run(sql<void>`
    CREATE TABLE external_accounts (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_id TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      UNIQUE (provider, external_id),
      UNIQUE (user_id, provider)
    )
  `);
}

const EXTERNAL_USER_ID = 'user_external_2';
const PRIMARY_AUTH_PROVIDER = 'better-auth';

describe('AccountProvisioningService', () => {
  let sqlClient: SqlClient;

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrateAuthTables(sqlClient);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('returns existing user id for known external user', async () => {
    const userId = '33333333-3333-4333-8333-333333333333';
    const now = new Date(io.clock.now()).toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO users (id, created_at)
      VALUES (${userId}, ${now})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO external_accounts (
        id,
        user_id,
        provider,
        external_id,
        metadata,
        created_at
      )
      VALUES (
        ${`${PRIMARY_AUTH_PROVIDER}:${EXTERNAL_USER_ID}`},
        ${userId},
        ${PRIMARY_AUTH_PROVIDER},
        ${EXTERNAL_USER_ID},
        ${'{}'},
        ${now}
      )
    `);

    const resolved = await new AccountProvisioningService(
      sqlClient,
      makeFakeAuthServer(null)
    ).ensureInternalAccountIdForExternalUser({
      externalUserId: EXTERNAL_USER_ID,
      now: io.clock.now,
      createId: io.createId,
    });

    expect(resolved).toBe(userId);
  });

  test('creates user and external_account row', async () => {
    const externalAccounts = new ExternalAccountRepository(sqlClient);
    const resolved = await new AccountProvisioningService(
      sqlClient,
      makeFakeAuthServer({ id: EXTERNAL_USER_ID, email: 'a@b.c' })
    ).ensureInternalAccountIdForExternalUser({
      externalUserId: EXTERNAL_USER_ID,
      now: io.clock.now,
      createId: io.createId,
    });

    expect(
      await externalAccounts.findUserIdByPrimaryAuthExternalId(
        PRIMARY_AUTH_PROVIDER,
        EXTERNAL_USER_ID
      )
    ).toBe(resolved);
    expect(
      await externalAccounts.readExternalAccountId(
        resolved,
        PRIMARY_AUTH_PROVIDER
      )
    ).toBe(EXTERNAL_USER_ID);
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
    const provisioning = new AccountProvisioningService(sqlClient, authServer);
    const a = await provisioning.ensureInternalAccountIdForExternalUser({
      externalUserId: EXTERNAL_USER_ID,
      now: io.clock.now,
      createId: io.createId,
    });
    const b = await provisioning.ensureInternalAccountIdForExternalUser({
      externalUserId: EXTERNAL_USER_ID,
      now: io.clock.now,
      createId: io.createId,
    });

    expect(a).toBe(b);
    expect(
      await new ExternalAccountRepository(
        sqlClient
      ).findUserIdByPrimaryAuthExternalId(
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
    const now = new Date(io.clock.now()).toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO users (id, created_at)
      VALUES (${winnerId}, ${now})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO external_accounts (
        id,
        user_id,
        provider,
        external_id,
        metadata,
        created_at
      )
      VALUES (
        ${`${PRIMARY_AUTH_PROVIDER}:${EXTERNAL_USER_ID}`},
        ${winnerId},
        ${PRIMARY_AUTH_PROVIDER},
        ${EXTERNAL_USER_ID},
        ${'{}'},
        ${now}
      )
    `);

    const resolved = await new AccountProvisioningService(
      sqlClient,
      makeFakeAuthServer({ id: EXTERNAL_USER_ID })
    ).ensureInternalAccountIdForExternalUser({
      externalUserId: EXTERNAL_USER_ID,
      now: io.clock.now,
      createId: io.createId,
    });

    expect(resolved).toBe(winnerId);
  });
});
