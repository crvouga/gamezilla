import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';

import { ExternalAccountRepository } from './external-account-repository';

const io = createSimIo({ seed: 1 });

async function migrateTables(db: SqlClient): Promise<void> {
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

describe('ExternalAccountRepository', () => {
  let sqlClient: SqlClient;
  let repo: ExternalAccountRepository;
  const userId = '11111111-1111-4111-8111-111111111111';
  const primaryAuthProvider = 'better-auth';
  const externalUserId = 'user_ext_1';

  beforeEach(async () => {
    sqlClient = SqlClientImplBunSqlite.open(':memory:');
    await sqlClient.connect();
    await migrateTables(sqlClient);
    repo = new ExternalAccountRepository(sqlClient);
    await repo.insertUser({
      userId,
      now: io.clock.now,
      createId: io.createId,
    });
  });

  afterEach(async () => {
    await sqlClient.disconnect();
  });

  test('upsertExternalAccount inserts and updates metadata', async () => {
    await repo.upsertExternalAccount({
      userId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      metadata: { email: 'a@example.com' },
      now: io.clock.now,
      createId: io.createId,
    });

    expect(
      await repo.findUserIdByProviderExternalId(
        primaryAuthProvider,
        externalUserId
      )
    ).toBe(userId);
    expect(await repo.readExternalAccountId(userId, primaryAuthProvider)).toBe(
      externalUserId
    );

    await repo.upsertExternalAccount({
      userId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      metadata: { email: 'b@example.com' },
      now: io.clock.now,
      createId: io.createId,
    });

    const rows = await sqlClient.query(sql<{ metadata: string }>`
      SELECT metadata
      FROM external_accounts
      WHERE provider = ${primaryAuthProvider}
        AND external_id = ${externalUserId}
    `);
    const metadata = JSON.parse(rows[0]!.metadata) as Record<string, unknown>;
    expect(metadata['email']).toBe('b@example.com');
  });

  test('findUserIdByPrimaryAuthExternalId resolves primary provider rows', async () => {
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
        ${`${primaryAuthProvider}:${externalUserId}`},
        ${userId},
        ${primaryAuthProvider},
        ${externalUserId},
        ${'{}'},
        ${new Date(io.clock.now()).toISOString()}
      )
    `);

    expect(
      await repo.findUserIdByPrimaryAuthExternalId(
        primaryAuthProvider,
        externalUserId
      )
    ).toBe(userId);
  });

  test('enforces one provider row per user', async () => {
    await repo.upsertExternalAccount({
      userId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      now: io.clock.now,
      createId: io.createId,
    });

    await expect(
      repo.upsertExternalAccount({
        userId,
        provider: primaryAuthProvider,
        externalId: 'user_ext_2',
        now: io.clock.now,
        createId: io.createId,
      })
    ).rejects.toThrow();
  });

  test('upsertExternalAccount never reassigns user_id on conflict', async () => {
    const otherUserId = '22222222-2222-4222-8222-222222222222';
    await repo.insertUser({
      userId: otherUserId,
      now: io.clock.now,
      createId: io.createId,
    });
    await repo.upsertExternalAccount({
      userId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      metadata: { email: 'owner@example.com' },
      now: io.clock.now,
      createId: io.createId,
    });

    await repo.upsertExternalAccount({
      userId: otherUserId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      metadata: { email: 'thief@example.com' },
      now: io.clock.now,
      createId: io.createId,
    });

    expect(
      await repo.findUserIdByProviderExternalId(
        primaryAuthProvider,
        externalUserId
      )
    ).toBe(userId);

    const rows = await sqlClient.query(sql<{ metadata: string }>`
      SELECT metadata
      FROM external_accounts
      WHERE provider = ${primaryAuthProvider}
        AND external_id = ${externalUserId}
    `);
    const metadata = JSON.parse(rows[0]!.metadata) as Record<string, unknown>;
    // Wrong-owner upsert must not rewrite metadata either (WHERE guard).
    expect(metadata['email']).toBe('owner@example.com');
  });

  test('insertExternalAccountOrGet adopts existing owner', async () => {
    const otherUserId = '22222222-2222-4222-8222-222222222222';
    await repo.insertUser({
      userId: otherUserId,
      now: io.clock.now,
      createId: io.createId,
    });
    await repo.insertExternalAccountOrGet({
      userId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      now: io.clock.now,
      createId: io.createId,
    });

    const adopted = await repo.insertExternalAccountOrGet({
      userId: otherUserId,
      provider: primaryAuthProvider,
      externalId: externalUserId,
      now: io.clock.now,
      createId: io.createId,
    });

    expect(adopted).toBe(userId);
    expect(
      await repo.findUserIdByProviderExternalId(
        primaryAuthProvider,
        externalUserId
      )
    ).toBe(userId);
  });
});
