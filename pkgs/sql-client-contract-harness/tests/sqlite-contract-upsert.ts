import { test } from 'bun:test';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import sql, { raw } from '@pkgs/sql-shared/sql';
import { applySchema, expectQuery, setup } from './sqlite-contract-helpers';
import type { SqliteClientGetter } from './sqlite-contract-helpers';

export function registerSqliteUpsertTests(getClient: SqliteClientGetter): void {
  test('ON CONFLICT DO UPDATE WHERE', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'auth',
        name: 'auth_external_accounts',
        columns: {
          user_id: 'text',
          provider: 'text',
          external_id: 'text',
          metadata: 'text',
        },
        uniqueIndexes: [['provider', 'external_id']],
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO auth_external_accounts (
          id, user_id, provider, external_id, metadata, updated_at
        ) VALUES (
          ${'idp:ext1'}, ${'user-a'}, ${'idp'}, ${'ext1'},
          ${'{}'}, ${'t0'}
        )
      `,
      sql<void>`
        INSERT INTO auth_external_accounts (
          id, user_id, provider, external_id, metadata, updated_at
        )
        VALUES (
          ${'idp:ext1'}, ${'user-a'}, ${'idp'}, ${'ext1'},
          ${'{"email":"a@b.co"}'}, ${'t1'}
        )
        ON CONFLICT (provider, external_id) DO UPDATE SET
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
        WHERE auth_external_accounts.user_id = excluded.user_id
      `,
    ]);
    await expectQuery(
      client,
      raw<{ metadata: string; updated_at: string }>(
        'SELECT metadata, updated_at FROM auth_external_accounts'
      ),
      [{ metadata: '{"email":"a@b.co"}', updated_at: 't1' }]
    );
  });

  test('ON CONFLICT DO UPDATE with reserved col value', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'client_config',
        name: 'client_config',
        columns: { value: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`
        INSERT INTO client_config (id, created_at, updated_at, deleted_at, value)
        VALUES (${'k'}, ${'t0'}, ${'t0'}, NULL, ${'"old"'})
      `,
      sql<void>`
        INSERT INTO client_config (id, created_at, updated_at, deleted_at, value)
        VALUES (${'k'}, ${'t1'}, ${'t1'}, NULL, ${'"new"'})
        ON CONFLICT (id) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL
      `,
    ]);
    await expectQuery(
      client,
      raw<{ value: string; updated_at: string }>(
        'SELECT value, updated_at FROM client_config'
      ),
      [{ value: '"new"', updated_at: 't1' }]
    );
  });

  test('ON CONFLICT upsert increments and RETURNING', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'sync_engine',
        name: 'sync_engine_topic_seq',
        columns: { topic: 'text', n: 'integer' },
        uniqueIndexes: ['topic'],
      }),
    ]);
    const upsert = sql<{ n: number }>`
      INSERT INTO sync_engine_topic_seq (id, topic, n)
      VALUES (${'system:client_config'}, ${'system:client_config'}, 1)
      ON CONFLICT (topic) DO UPDATE
        SET n = sync_engine_topic_seq.n + 1
      RETURNING n
    `;
    await expectQuery(client, upsert, [{ n: 1 }]);
    await expectQuery(client, upsert, [{ n: 2 }]);
  });

  test('multi-row ON CONFLICT upsert RETURNING (allocateTopicPushSeqs)', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'sync_engine',
        name: 'sync_engine_topic_seq',
        columns: { topic: 'text', n: 'integer' },
        uniqueIndexes: ['topic'],
      }),
    ]);
    const multi = sql<{ topic: string; n: number }>`
      INSERT INTO sync_engine_topic_seq (id, topic, n)
      VALUES (${'t1'}, ${'t1'}, 1), (${'t2'}, ${'t2'}, 1)
      ON CONFLICT (topic) DO UPDATE
        SET n = sync_engine_topic_seq.n + 1
      RETURNING topic, n
    `;
    await expectQuery(client, multi, [
      { topic: 't1', n: 1 },
      { topic: 't2', n: 1 },
    ]);
    await expectQuery(client, multi, [
      { topic: 't1', n: 2 },
      { topic: 't2', n: 2 },
    ]);
  });

  test('ON CONFLICT DO NOTHING leaves existing row', async () => {
    const client = getClient();
    await applySchema(client, [
      defineTable({
        domain: 'kv',
        name: 'kv',
        columns: { v: 'text' },
      }),
    ]);
    await setup(client, [
      sql<void>`INSERT INTO kv (id, v) VALUES (${'k'}, ${'old'})`,
      sql<void>`
        INSERT INTO kv (id, v) VALUES (${'k'}, ${'new'})
        ON CONFLICT (id) DO NOTHING
      `,
    ]);
    await expectQuery(
      client,
      raw<{ id: string; v: string }>('SELECT id, v FROM kv'),
      [{ id: 'k', v: 'old' }]
    );
  });
}
