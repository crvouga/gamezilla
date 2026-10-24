import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { kvSchema } from '@pkgs/kv-root-shared-ts/tables';
import { outboxDeliveries } from '@pkgs/outbox-shared-ts/tables';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const LEGACY_OUTBOX = registerTables([
  defineTable({
    domain: 'outbox',
    name: 'outbox_events',
    columns: { type: 'text', payload: 'json', available_at: 'timestamp' },
    indexes: ['type', 'available_at'],
  }),
  outboxDeliveries,
]);

export async function priorFrameworkSeed() {
  const client = SqlClientImplMockingbirdPostgres.open();
  await client.connect();
  try {
    for (const schema of [LEGACY_OUTBOX, kvSchema])
      await reconcilePostgresSchema(
        client,
        schema,
        createPostgresDbScope('public'),
        {
          skipAdvisoryLock: true,
          alreadyInTransaction: false,
          indexPhase: 'inline',
        }
      );
    await client.run(
      sql`INSERT INTO kv (id, key, value) VALUES (${'canonical'}, ${'canonical'}, ${'"stale-generated-value"'})`
    );
    return client.exportDatabaseBytes();
  } finally {
    await client.disconnect();
  }
}
