import { appSchema } from '@libs/runtime/root/app-schema';
import { AuthPostgresDatabaseMigration } from '@pkgs/auth/server';
import type { Clock } from '@pkgs/clock';
import {
  ComposedDatabaseMigration,
  EnsurePostgresSchemaMigration,
  PostgresAdvisoryLockedTransactionMigration,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema/postgres';
import { EntityStorePostgresDatabaseMigration } from '@pkgs/entity-store/postgres-database-migration';
import { KvPostgresDatabaseMigration } from '@pkgs/kv/postgres-database-migration';
import type { Logger } from '@pkgs/logger';
import { OutboxDatabaseMigration } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import { CutoverLegacyAuthToIdpMigration } from './cutover-legacy-auth-to-idp-migration';
import { DomainSchemaNullabilityMigration } from './domain-schema-nullability-migration';
import { HardCutoverDropLegacyTablesMigration } from './hard-cutover-drop-legacy-tables-migration';
import { PostgresIndexesDatabaseMigration } from './postgres-indexes-database-migration';
import { PostgresSqliteCompatMigration } from './postgres-sqlite-compat-migration';
import { PurgeClerkExternalAccountsMigration } from './purge-clerk-external-accounts-migration';

/**
 * Session/transaction advisory lock for app migrate. Serializes concurrent
 * migrates (api + `@pkgs/postgres-embedded` boot, parallel CI jobs) so they wait instead
 * of thrashing on DDL `lock_timeout`. Distinct from the matchmaking tick lock id.
 */
export const POSTGRES_MIGRATE_ADVISORY_LOCK_ID = '872014001234567890';

export type PostgresMigrationRunnerDeps = {
  sqlClient: SqlClient;
  logger: Logger;
  dbScope: PostgresDbScope;
  /**
   * When true, skip `pg_advisory_xact_lock` + outer transaction (postgres-mem /
   * single-process sims cannot nest SET LOCAL with DO-block DDL on one adapter pool).
   */
  skipAdvisoryLock?: boolean;
  /**
   * When true, skip PL/pgSQL {@link PostgresSqliteCompatMigration}.
   * Use when JSON1 shims are installed at SqlClient open time (postgres-mem).
   */
  skipSqliteCompat?: boolean;
  /**
   * When true, skip workload {@link PostgresIndexesDatabaseMigration}.
   * Defaults to true when `skipAdvisoryLock` (sim / postgres-mem).
   */
  skipIndexReconcile?: boolean;
  /** Injected clock for index reconcile deadlines (required unless skipped). */
  clock?: Clock;
};

export class PostgresMigrationRunner {
  constructor(private readonly deps: PostgresMigrationRunnerDeps) {}

  async run(): Promise<void> {
    const {
      sqlClient,
      logger,
      dbScope,
      skipAdvisoryLock = false,
      skipSqliteCompat = false,
      skipIndexReconcile = skipAdvisoryLock,
      clock,
    } = this.deps;

    const locked = new ComposedDatabaseMigration()
      .register(new HardCutoverDropLegacyTablesMigration())
      .register(new SyncEngineDatabaseMigration())
      .register(new OutboxDatabaseMigration())
      .register(new DomainSchemaNullabilityMigration())
      .register(
        new PostgresSchemaDatabaseMigration(appSchema, dbScope, {
          skipAdvisoryLock: true,
          alreadyInTransaction: !skipAdvisoryLock,
        })
      )
      .register(new KvPostgresDatabaseMigration())
      .register(new EntityStorePostgresDatabaseMigration());

    const databaseMigration = new ComposedDatabaseMigration().register(
      new EnsurePostgresSchemaMigration(dbScope)
    );
    if (!skipSqliteCompat) {
      databaseMigration.register(new PostgresSqliteCompatMigration());
    }
    databaseMigration
      .register(
        skipAdvisoryLock
          ? locked
          : new PostgresAdvisoryLockedTransactionMigration({
              lockId: POSTGRES_MIGRATE_ADVISORY_LOCK_ID,
              inner: locked,
            })
      )
      .register(
        new AuthPostgresDatabaseMigration({
          dbScope,
          skipAdvisoryLock: true,
          alreadyInTransaction: false,
        })
      )
      .register(new CutoverLegacyAuthToIdpMigration())
      .register(new PurgeClerkExternalAccountsMigration());

    if (!skipIndexReconcile) {
      if (clock === undefined) {
        throw new Error(
          'PostgresMigrationRunner: clock required when index reconcile is enabled'
        );
      }
      databaseMigration.register(
        new PostgresIndexesDatabaseMigration({ clock })
      );
    }

    await databaseMigration.migrate({ sqlClient, logger });
  }
}
