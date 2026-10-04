import { matchmakingSchema } from '@pkgs/matchmaking-sql';
/**
 * Reconcile a fresh harness database for exactly the features a composition runs.
 *
 * A subsystem harness starts from an empty mockingbird-postgres. What every
 * composition needs is the framework tables, its own domain schema, and the IdP.
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import type { ComposedFeatures } from '@libs/feature/public/compose';
import { assert } from '@pkgs/assert';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse/server';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres';
import { reconcileEntityStorePostgres } from '@pkgs/entity-store/reconcile-postgres';
import { reconcileEntityStoreSqlite } from '@pkgs/entity-store/reconcile-sqlite';
import { reconcileKvSqlite } from '@pkgs/kv/reconcile-sqlite';
import { reconcileKvPostgres } from '@pkgs/kv-postgres/reconcile-postgres';
import { createLogger } from '@pkgs/logger';
import { reconcileOutboxPostgres } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres/ensure-schema';
import { migrateLocalSchema } from '@pkgs/sync-engine/client';
import { reconcileSyncEnginePostgres } from '@pkgs/sync-engine/shared';

import type {
  HarnessComposition,
  MigrateHarnessPostgres,
} from '../composition';

const HARNESS_RECONCILE = {
  skipAdvisoryLock: true,
  alreadyInTransaction: false,
} as const;

async function reconcileHarnessSchemas(
  sqlClient: SqlClient,
  app: ComposedFeatures,
  now: () => number
): Promise<void> {
  const dbScope: PostgresDbScope = appPostgresDbScope();
  const options = { dbScope, ...HARNESS_RECONCILE };
  await ensurePostgresSchema(sqlClient, dbScope);
  await reconcileSyncEnginePostgres(sqlClient, options);
  await reconcileOutboxPostgres(sqlClient, options);
  await reconcilePostgresSchema(sqlClient, matchmakingSchema, dbScope, {
    ...HARNESS_RECONCILE,
    indexPhase: 'inline',
  });
  await reconcilePostgresSchema(sqlClient, app.schema, dbScope, {
    ...HARNESS_RECONCILE,
    indexPhase: 'inline',
  });
  await reconcileKvPostgres(
    sqlClient,
    createLogger({
      name: 'harness:reconcile-postgres',
      level: 'silent',
      now,
    }),
    options
  );
  await reconcileEntityStorePostgres(sqlClient, options);
  const reconcileIdp = INHOUSE_AUTH_PROVIDER.reconcilePostgres;
  assert.defined(reconcileIdp, 'in-house IdP declares its Postgres schema');
  await reconcileIdp({ sqlClient, dbScope });
}

/** Server Postgres: framework + the composition's domain schema + kv/entity + IdP. */
export function migrateCompositionPostgres(
  app: ComposedFeatures
): MigrateHarnessPostgres {
  return async (args) => {
    await reconcileHarnessSchemas(args.sqlClient, app, args.now);
  };
}

/** The composition's server reconcile: its own, or the default above. */
export function compositionMigratePostgres(
  composition: HarnessComposition
): MigrateHarnessPostgres {
  return (
    composition.migratePostgres ?? migrateCompositionPostgres(composition.app)
  );
}

/** Client local SQLite: framework local tables + domain cache + kv/entity. */
export async function migrateCompositionClientSqlite(
  app: ComposedFeatures,
  args: { readonly sqlClient: SqlClient; readonly now: () => number }
): Promise<void> {
  await migrateLocalSchema(args.sqlClient, {
    domainSchema: app.schema,
    cacheTableNames: app.tableNames,
  });
  await reconcileKvSqlite(args.sqlClient);
  await reconcileEntityStoreSqlite(args.sqlClient);
  void args.now;
}
