import { expect, test } from 'bun:test';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { reconcileDeclaredPostgresSchemas } from '@libs/runtime-server/reconcile-declared-schemas';
import { indexFingerprintName } from '@pkgs/db-schema-shared/index-fingerprint';
import { createLogger } from '@pkgs/logger-shared/logger';
import { createMockingbirdPostgresSqlClient } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import sql from '@pkgs/sql-shared/sql';

// regression: deploy-missing-framework-indexes
test.each([false, true])(
  'reconciliation creates framework conflict indexes (inline: %s)',
  async (skipIndexReconcile) => {
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
        skipIndexReconcile,
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
      const matchmakingIndexes = await sqlClient.query(sql<{
        indexname: string;
      }>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = ${dbScope.schema} AND tablename = ${'matchmaking_active_partitions'}
    `);
      expect(matchmakingIndexes.map(({ indexname }) => indexname)).toContain(
        indexFingerprintName(
          'matchmaking_active_partitions',
          ['partition_signature', 'group_size'],
          true
        )
      );
    } finally {
      await sqlClient.disconnect();
    }
  },
  30_000
);
