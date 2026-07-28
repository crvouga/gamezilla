import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { raw, sql } from '@pkgs/sql';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';

import {
  EXTERNAL_ACCOUNTS_TABLE,
  ExternalAccountCol,
  USERS_TABLE,
  UserTableCol,
} from '@libs/db/shared/external-accounts-tables';

import {
  findUserIdByPrimaryAuthExternalId,
  findUserIdByProviderExternalId,
  insertUser,
  readExternalAccountId,
  upsertExternalAccount,
} from './external-accounts-sql';

async function migrateTables(db: SqlClient): Promise<void> {
  await db.run(sql`
    CREATE TABLE ${raw(USERS_TABLE)} (
      ${raw(UserTableCol.id)} TEXT PRIMARY KEY,
      ${raw(UserTableCol.createdAt)} TEXT NOT NULL
    )
  `);
  await db.run(sql`
    CREATE TABLE ${raw(EXTERNAL_ACCOUNTS_TABLE)} (
      ${raw(ExternalAccountCol.userId)} TEXT NOT NULL,
      ${raw(ExternalAccountCol.provider)} TEXT NOT NULL,
      ${raw(ExternalAccountCol.externalId)} TEXT NOT NULL,
      ${raw(ExternalAccountCol.metadata)} TEXT NOT NULL DEFAULT '{}',
      ${raw(ExternalAccountCol.createdAt)} TEXT NOT NULL,
      PRIMARY KEY (${raw(ExternalAccountCol.provider)}, ${raw(ExternalAccountCol.externalId)}),
      UNIQUE (${raw(ExternalAccountCol.userId)}, ${raw(ExternalAccountCol.provider)})
    )
  `);
}

describe('external-accounts-sql', () => {
  let sqlClient: SqlClient;
  const userId = '11111111-1111-4111-8111-111111111111';
  const primaryAuthProvider = 'clerk';
  const clerkUserId = 'user_clerk_1';

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrateTables(sqlClient);
    await insertUser(sqlClient, userId);
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('upsertExternalAccount inserts and updates metadata', async () => {
    await upsertExternalAccount(sqlClient, {
      userId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
      metadata: { email: 'a@example.com' },
    });

    expect(
      await findUserIdByProviderExternalId(
        sqlClient,
        primaryAuthProvider,
        clerkUserId
      )
    ).toBe(userId);
    expect(
      await readExternalAccountId(sqlClient, userId, primaryAuthProvider)
    ).toBe(clerkUserId);

    await upsertExternalAccount(sqlClient, {
      userId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
      metadata: { email: 'b@example.com' },
    });

    const rows = await sqlClient.query<{ metadata: string }>(sql`
      SELECT ${raw(ExternalAccountCol.metadata)} AS metadata
      FROM ${raw(EXTERNAL_ACCOUNTS_TABLE)}
      WHERE ${raw(ExternalAccountCol.provider)} = ${primaryAuthProvider} AND ${raw(ExternalAccountCol.externalId)} = ${clerkUserId}
    `);
    const metadata = JSON.parse(rows[0]!.metadata) as Record<string, unknown>;
    expect(metadata['email']).toBe('b@example.com');
  });

  test('findUserIdByPrimaryAuthExternalId resolves primary provider rows', async () => {
    await sqlClient.run(sql`
      INSERT INTO ${raw(EXTERNAL_ACCOUNTS_TABLE)}
      (${raw(ExternalAccountCol.userId)}, ${raw(ExternalAccountCol.provider)},
       ${raw(ExternalAccountCol.externalId)}, ${raw(ExternalAccountCol.metadata)},
       ${raw(ExternalAccountCol.createdAt)})
      VALUES (${userId}, ${primaryAuthProvider}, ${clerkUserId}, '{}', ${new Date().toISOString()})
    `);

    expect(
      await findUserIdByPrimaryAuthExternalId(
        sqlClient,
        primaryAuthProvider,
        clerkUserId
      )
    ).toBe(userId);
  });

  test('enforces one provider row per user', async () => {
    await upsertExternalAccount(sqlClient, {
      userId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
    });

    await expect(
      upsertExternalAccount(sqlClient, {
        userId,
        provider: primaryAuthProvider,
        externalId: 'user_clerk_2',
      })
    ).rejects.toThrow();
  });
});
