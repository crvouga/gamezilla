/**
 * Migrate a fresh harness database for exactly the features a composition runs.
 *
 * A subsystem harness starts from an empty mockingbird-postgres, so none of the
 * production runner's cutovers (legacy tables, integer widths, Clerk purges)
 * have anything to do; they belong to the full composition, which passes the
 * production runner as `migratePostgres`. What every composition needs is the
 * framework tables, its own domain schema, and the IdP.
 */

import { appPostgresDbScope } from '@libs/db/public/scope';
import type { ComposedFeatures } from '@libs/feature/public/compose';
import { assert } from '@pkgs/assert';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse/server';
import {
  ComposedDatabaseMigration,
  type DatabaseMigration,
  EnsurePostgresSchemaMigration,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema-postgres';
import { EntityStorePostgresDatabaseMigration } from '@pkgs/entity-store/postgres-database-migration';
import { EntityStoreSqliteDatabaseMigration } from '@pkgs/entity-store/sqlite-database-migration';
import { KvSqliteDatabaseMigration } from '@pkgs/kv/sqlite-database-migration';
import { KvPostgresDatabaseMigration } from '@pkgs/kv-postgres/postgres-database-migration';
import { createLogger } from '@pkgs/logger';
import { OutboxDatabaseMigration } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { migrateLocalSchema } from '@pkgs/sync-engine/client';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';

import type {
  HarnessComposition,
  MigrateHarnessPostgres,
} from '../composition';

/** The simulated deployment signs in through the in-house IdP: its tables. */
function inhouseIdpMigration(dbScope: PostgresDbScope): DatabaseMigration {
  const migration = INHOUSE_AUTH_PROVIDER.postgresMigration?.({ dbScope });
  assert.defined(migration, 'in-house IdP declares its Postgres schema');
  return migration;
}

/** Server Postgres: framework + the composition's domain schema + kv/entity + IdP. */
export function migrateCompositionPostgres(
  app: ComposedFeatures
): MigrateHarnessPostgres {
  return async (args) => {
    const dbScope = appPostgresDbScope();
    await new ComposedDatabaseMigration()
      .register(new EnsurePostgresSchemaMigration(dbScope))
      .register(new SyncEngineDatabaseMigration())
      .register(new OutboxDatabaseMigration())
      .register(
        new PostgresSchemaDatabaseMigration(app.schema, dbScope, {
          skipAdvisoryLock: true,
          alreadyInTransaction: false,
          indexPhase: 'inline',
        })
      )
      .register(new KvPostgresDatabaseMigration())
      .register(new EntityStorePostgresDatabaseMigration())
      .register(inhouseIdpMigration(dbScope))
      .migrate({
        sqlClient: args.sqlClient,
        logger: createLogger({
          name: 'harness:migrate-postgres',
          level: 'silent',
          now: args.now,
        }),
      });
  };
}

/** The composition's server migrate: its own, or the default above. */
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
  const ctx = {
    sqlClient: args.sqlClient,
    logger: createLogger({
      name: 'harness:migrate-client',
      level: 'silent',
      now: args.now,
    }),
  };
  await new KvSqliteDatabaseMigration().migrate(ctx);
  await new EntityStoreSqliteDatabaseMigration().migrate(ctx);
}
