import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { SqlClientImplBunSqlite } from '@pkgs/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  EXTERNAL_ACCOUNT_PROVIDER_CLERK,
  LEGACY_EXTERNAL_ACCOUNT_PROVIDER_AUTH,
} from '../shared/external-account-providers';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
  USERS_TABLE,
  UserTableCol,
} from '../shared/external-accounts-tables';

import {
  findUserIdByClerkUserId,
  findUserIdByProviderExternalId,
  insertUser,
  readExternalAccountId,
  upsertExternalAccount,
} from './external-accounts-sql';

async function migrateTables(sql: SqlClient): Promise<void> {
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
}

describe('external-accounts-sql', () => {
  let sql: SqlClient;
  const userId = '11111111-1111-4111-8111-111111111111';
  const clerkUserId = 'user_clerk_1';

  beforeEach(async () => {
    sql = SqlClientImplBunSqlite.open(':memory:');
    await sql.connect();
    await migrateTables(sql);
    await insertUser(sql, userId);
  });

  afterEach(async () => {
    await sql.disconnect();
  });

  test('upsertExternalAccount inserts and updates metadata', async () => {
    await upsertExternalAccount(sql, {
      userId,
      provider: EXTERNAL_ACCOUNT_PROVIDER_CLERK,
      externalId: clerkUserId,
      metadata: { email: 'a@example.com' },
    });

    expect(
      await findUserIdByProviderExternalId(
        sql,
        EXTERNAL_ACCOUNT_PROVIDER_CLERK,
        clerkUserId
      )
    ).toBe(userId);
    expect(
      await readExternalAccountId(sql, userId, EXTERNAL_ACCOUNT_PROVIDER_CLERK)
    ).toBe(clerkUserId);

    await upsertExternalAccount(sql, {
      userId,
      provider: EXTERNAL_ACCOUNT_PROVIDER_CLERK,
      externalId: clerkUserId,
      metadata: { email: 'b@example.com' },
    });

    const rows = await sql.query<{ metadata: string }>(
      `SELECT ${ExternalAccountCol.metadata} AS metadata
       FROM ${EXTERNAL_ACCOUNTS_TABLE}
       WHERE ${ExternalAccountCol.provider} = ? AND ${ExternalAccountCol.externalId} = ?`,
      [EXTERNAL_ACCOUNT_PROVIDER_CLERK, clerkUserId]
    );
    const metadata = JSON.parse(rows[0]!.metadata) as Record<string, unknown>;
    expect(metadata['email']).toBe('b@example.com');
  });

  test('findUserIdByClerkUserId resolves legacy auth slug rows', async () => {
    await sql.run(
      `INSERT INTO ${EXTERNAL_ACCOUNTS_TABLE}
       (${ExternalAccountCol.userId}, ${ExternalAccountCol.provider},
        ${ExternalAccountCol.externalId}, ${ExternalAccountCol.metadata},
        ${ExternalAccountCol.createdAt})
       VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        LEGACY_EXTERNAL_ACCOUNT_PROVIDER_AUTH,
        clerkUserId,
        '{}',
        new Date().toISOString(),
      ]
    );

    expect(await findUserIdByClerkUserId(sql, clerkUserId)).toBe(userId);
  });

  test('enforces one provider row per user', async () => {
    await upsertExternalAccount(sql, {
      userId,
      provider: EXTERNAL_ACCOUNT_PROVIDER_CLERK,
      externalId: clerkUserId,
    });

    await expect(
      upsertExternalAccount(sql, {
        userId,
        provider: EXTERNAL_ACCOUNT_PROVIDER_CLERK,
        externalId: 'user_clerk_2',
      })
    ).rejects.toThrow();
  });
});
