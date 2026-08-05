import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import {
  findUserIdByPrimaryAuthExternalId,
  findUserIdByProviderExternalId,
  insertExternalAccountOrGet,
  insertUser,
  readExternalAccountId,
  upsertExternalAccount,
} from './external-accounts-sql';

async function migrateTables(db: SqlClient): Promise<void> {
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

    const rows = await sqlClient.query(sql<{ metadata: string }>`
      SELECT metadata
      FROM external_accounts
      WHERE provider = ${primaryAuthProvider}
        AND external_id = ${clerkUserId}
    `);
    const metadata = JSON.parse(rows[0]!.metadata) as Record<string, unknown>;
    expect(metadata['email']).toBe('b@example.com');
  });

  test('findUserIdByPrimaryAuthExternalId resolves primary provider rows', async () => {
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
        ${primaryAuthProvider},
        ${clerkUserId},
        ${'{}'},
        ${new Date().toISOString()}
      )
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

  test('upsertExternalAccount never reassigns user_id on conflict', async () => {
    const otherUserId = '22222222-2222-4222-8222-222222222222';
    await insertUser(sqlClient, otherUserId);
    await upsertExternalAccount(sqlClient, {
      userId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
      metadata: { email: 'owner@example.com' },
    });

    await upsertExternalAccount(sqlClient, {
      userId: otherUserId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
      metadata: { email: 'thief@example.com' },
    });

    expect(
      await findUserIdByProviderExternalId(
        sqlClient,
        primaryAuthProvider,
        clerkUserId
      )
    ).toBe(userId);

    const rows = await sqlClient.query(sql<{ metadata: string }>`
      SELECT metadata
      FROM external_accounts
      WHERE provider = ${primaryAuthProvider}
        AND external_id = ${clerkUserId}
    `);
    const metadata = JSON.parse(rows[0]!.metadata) as Record<string, unknown>;
    // Wrong-owner upsert must not rewrite metadata either (WHERE guard).
    expect(metadata['email']).toBe('owner@example.com');
  });

  test('insertExternalAccountOrGet adopts existing owner', async () => {
    const otherUserId = '22222222-2222-4222-8222-222222222222';
    await insertUser(sqlClient, otherUserId);
    await insertExternalAccountOrGet(sqlClient, {
      userId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
    });

    const adopted = await insertExternalAccountOrGet(sqlClient, {
      userId: otherUserId,
      provider: primaryAuthProvider,
      externalId: clerkUserId,
    });

    expect(adopted).toBe(userId);
    expect(
      await findUserIdByProviderExternalId(
        sqlClient,
        primaryAuthProvider,
        clerkUserId
      )
    ).toBe(userId);
  });
});
