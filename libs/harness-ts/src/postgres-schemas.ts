import type { ComposedSubs } from '@libs/sub-shared-ts/compose';
import { idpSchema } from '@pkgs/auth-inhouse-shared-ts/tables';
import type { Schema } from '@pkgs/db-schema-root-shared-ts/types';
import { entityStoreSchema } from '@pkgs/entity-store-shared-ts/tables';
import { reconcileKvPostgres } from '@pkgs/kv-postgres-shared-ts/reconcile-postgres';
import { kvSchema } from '@pkgs/kv-root-shared-ts/tables';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared-ts/tables';
import { outboxSchema } from '@pkgs/outbox-shared-ts/tables';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { syncEngineServerSchema } from '@pkgs/sync-engine-shared-ts/tables';

type SchemaContext = {
  readonly sqlClient: SqlClient;
  readonly dbScope: PostgresDbScope;
  readonly now: () => number;
};

type HarnessSchema = {
  readonly schema: Schema;
  readonly reconcile?: (ctx: SchemaContext) => Promise<void>;
};

/** One ordered registry drives both migration and seed compatibility. */
export function harnessPostgresSchemas(
  app: Pick<ComposedSubs, 'schema'>
): readonly HarnessSchema[] {
  return [
    { schema: syncEngineServerSchema },
    { schema: outboxSchema },
    { schema: matchmakingSchema },
    { schema: app.schema },
    {
      schema: kvSchema,
      reconcile: ({ sqlClient, dbScope, now }) =>
        reconcileKvPostgres(
          sqlClient,
          createLogger({
            name: 'harness:reconcile-postgres',
            level: 'silent',
            now,
          }),
          { dbScope, skipAdvisoryLock: true, alreadyInTransaction: false }
        ),
    },
    { schema: entityStoreSchema },
    { schema: idpSchema },
  ];
}
