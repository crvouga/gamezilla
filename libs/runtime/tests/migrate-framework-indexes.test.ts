import { expect, test } from 'bun:test';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { reconcileDeclaredPostgresSchemas } from '@libs/runtime/server/reconcile-declared-schemas';
import { indexFingerprintName } from '@pkgs/db-schema/core/index-fingerprint';
import { createLogger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';
import { createMockingbirdPostgresSqlClient } from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';

// regression: deploy-missing-framework-indexes
test('deployment reconciliation creates the outbox delivery conflict index', async () => {
  const dbScope = appPostgresDbScope();
  const { sqlClient } = createMockingbirdPostgresSqlClient({
    seed: 1,
    dbScope,
  });
  const clock = { now: () => 0 };
  const logger = createLogger({
    name: 'migration',
    level: 'silent',
    now: clock.now,
  });
  try {
    await reconcileDeclaredPostgresSchemas({
      sqlClient,
      dbScope,
      logger,
      skipAdvisoryLock: true,
      skipIndexReconcile: false,
    });
    const indexes = await sqlClient.query(sql<{ indexname: string }>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = ${dbScope.schema} AND tablename = ${'outbox_deliveries'}
    `);
    expect(indexes.map(({ indexname }) => indexname)).toContain(
      indexFingerprintName(
        'outbox_deliveries',
        ['event_id', 'consumer_id'],
        true
      )
    );
  } finally {
    await sqlClient.disconnect();
  }
}, 30_000);
