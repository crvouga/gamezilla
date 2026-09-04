/**
 * Pin BUG-2 product path: allocateTopicPushSeq twice after
 * syncEngineServerSchema (physical bigint `n` + ON CONFLICT n + CAST(1 AS BIGINT)).
 * Postgres-mem must not mix BigInt/number; SQLite must accept the same SQL
 * (`::bigint` is not portable).
 */
import { describe, expect, test } from 'bun:test';
import { applyPostgresSchema } from '@pkgs/db-schema/postgres';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { allocateTopicPushSeq } from '../../server/allocate-topic-push-seq';
import { syncEngineServerSchema } from '../../shared/schema/tables';

const NOW = () => Date.parse('2020-01-01T00:00:00.000Z');

async function expectThreeShots(client: SqlClient): Promise<void> {
  const first = await allocateTopicPushSeq(client, 'system:client_config', NOW);
  expect(first).toBe('1');
  const second = await allocateTopicPushSeq(
    client,
    'system:client_config',
    NOW
  );
  expect(second).toBe('2');
  const third = await allocateTopicPushSeq(client, 'system:client_config', NOW);
  expect(third).toBe('3');
}

describe('allocateTopicPushSeq', () => {
  test('postgres-mem two-shot upsert does not throw BigInt mix', async () => {
    const client = SqlClientImplPostgresMem.open({
      seed: 1,
      now: () => new Date('2020-01-01T00:00:00.000Z'),
      dbScope: createPostgresDbScope('public'),
    });
    await client.connect();
    try {
      await applyPostgresSchema(
        client,
        syncEngineServerSchema,
        createPostgresDbScope('public'),
        { skipAdvisoryLock: true }
      );
      await expectThreeShots(client);
    } finally {
      await client.disconnect();
    }
  });

  test('sqlite-mem two-shot upsert accepts portable CAST', async () => {
    const client = SqlClientImplSqliteMem.open();
    await client.connect();
    try {
      await applySqliteSchema(client, syncEngineServerSchema, {
        ownership: 'declared-only',
      });
      await expectThreeShots(client);
    } finally {
      await client.disconnect();
    }
  });
});
