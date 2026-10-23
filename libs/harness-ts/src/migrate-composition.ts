import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared-ts/tables';
/**
 * Reconcile a fresh harness database for exactly the subs a composition runs.
 *
 * A subsystem harness starts from an empty mockingbird-postgres. What every
 * composition needs is the framework tables, its own domain schema, and the IdP.
 */

import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import type { ComposedSubs } from '@libs/sub-shared-ts/compose';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { reconcileEntityStorePostgres } from '@pkgs/entity-store-shared-ts/reconcile-postgres';
import { reconcileEntityStoreSqlite } from '@pkgs/entity-store-shared-ts/reconcile-sqlite';
import { reconcileKvPostgres } from '@pkgs/kv-postgres-shared-ts/reconcile-postgres';
import { reconcileKvSqlite } from '@pkgs/kv-root-shared-ts/reconcile-sqlite';
import { createLogger } from '@pkgs/logger-shared-ts/logger';
import { reconcileOutboxPostgres } from '@pkgs/outbox-shared-ts/reconcile';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres-shared-ts/ensure-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { migrateLocalSchema } from '@pkgs/sync-engine-client-ts/local-schema-migrate';
import { reconcileSyncEnginePostgres } from '@pkgs/sync-engine-shared-ts/reconcile-sync-engine-postgres';

import type { HarnessComposition, MigrateHarnessPostgres } from './composition';

const HARNESS_RECONCILE = {
  skipAdvisoryLock: true,
  alreadyInTransaction: false,
} as const;

async function reconcileHarnessSchemas(
  sqlClient: SqlClient,
  app: ComposedSubs,
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
  app: ComposedSubs
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
  app: ComposedSubs,
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
