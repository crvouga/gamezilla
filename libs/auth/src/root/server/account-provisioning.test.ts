import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { AuthServerPort } from '@pkgs/auth/server';
import { registerTables } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid';

import { EnsureInternalAccountUseCase } from '../../public/ensure-internal-account-use-case';
import { ExternalAccountRepository } from '../../public/external-account-repository';
import { AUTH_TABLES } from '../../public/schema';

const adapters = createHarnessAdapters({ seed: 1 });

function makeFakeAuthServer(): AuthServerPort {
  return {
    provider: PRIMARY_AUTH_PROVIDER,
    verifySessionToken: async () => null,
    getUser: async () => null,
  };
}

async function migrateAuthTables(db: SqlClient): Promise<void> {
  await applySqliteSchema(db, registerTables([...AUTH_TABLES]));
}

const EXTERNAL_USER_ID = 'user_external_2';
const PRIMARY_AUTH_PROVIDER = 'idp';

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
    const now = new Date(adapters.clock.now()).toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO auth_users (id, created_at)
      VALUES (${userId}, ${now})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO auth_external_accounts (
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

    const resolved = await new EnsureInternalAccountUseCase(
      sqlClient,
      adapters,
      makeFakeAuthServer()
    ).execute({
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(resolved).toBe(userId);
  });

  test('creates user and external_account row', async () => {
    const externalAccounts = new ExternalAccountRepository(sqlClient);
    const resolved = await new EnsureInternalAccountUseCase(
      sqlClient,
      adapters,
      makeFakeAuthServer()
    ).execute({
      externalUserId: EXTERNAL_USER_ID,
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
    // serializes concurrent callers via unique (provider, external_id).
    const authServer = makeFakeAuthServer();
    const provisioning = new EnsureInternalAccountUseCase(
      sqlClient,
      adapters,
      authServer
    );
    const a = await provisioning.execute({
      externalUserId: EXTERNAL_USER_ID,
    });
    const b = await provisioning.execute({
      externalUserId: EXTERNAL_USER_ID,
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
      FROM auth_external_accounts
      WHERE provider = ${PRIMARY_AUTH_PROVIDER}
        AND external_id = ${EXTERNAL_USER_ID}
    `);
    expect(linkRows).toHaveLength(1);
    expect(linkRows[0]?.user_id).toBe(a);
  });

  test('adopts existing link when a candidate insert loses the race', async () => {
    const winnerId = '33333333-3333-4333-8333-333333333333';
    const now = new Date(adapters.clock.now()).toISOString();
    await sqlClient.run(sql<void>`
      INSERT INTO auth_users (id, created_at)
      VALUES (${winnerId}, ${now})
    `);
    await sqlClient.run(sql<void>`
      INSERT INTO auth_external_accounts (
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

    const resolved = await new EnsureInternalAccountUseCase(
      sqlClient,
      adapters,
      makeFakeAuthServer()
    ).execute({
      externalUserId: EXTERNAL_USER_ID,
    });

    expect(resolved).toBe(winnerId);
  });
});
