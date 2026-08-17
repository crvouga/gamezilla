/**
 * Canonical Postgres migration order: compose {@link DatabaseMigration}
 * units (ensure schema → postgres-sqlite-compat → advisory-locked hard-cutover
 * drop + framework/domain/kv/entity_store → Better Auth → purge Clerk links).
 */

import { appSchema } from '@libs/db/shared/app-schema';
import { BetterAuthDatabaseMigration } from '@pkgs/auth-better-auth/server';
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
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import { HardCutoverDropLegacyTablesMigration } from './hard-cutover-drop-legacy-tables-migration';
import { PostgresSqliteCompatMigration } from './postgres-sqlite-compat-migration';
import { PurgeClerkExternalAccountsMigration } from './purge-clerk-external-accounts-migration';

/**
 * Session/transaction advisory lock for app migrate. Serializes concurrent
 * migrates (api + `@apps/postgres` boot, parallel CI jobs) so they wait instead
 * of thrashing on DDL `lock_timeout`. Distinct from the matchmaking tick lock id.
 */
export const POSTGRES_MIGRATE_ADVISORY_LOCK_ID = '872014001234567890';

export type PostgresMigrationRunnerDeps = {
  sqlClient: SqlClient;
  /** Pinned pool for Better Auth Kysely migrations (same TCP session). */
  pool: Pool;
  logger: Logger;
  dbScope: PostgresDbScope;
  /** Used as Better Auth baseURL during migrate (placeholder OK). */
  betterAuthBaseURL: string;
  betterAuthSecret: string;
  /**
   * When true, skip `pg_advisory_xact_lock` + outer transaction (pg-mem / single-process
   * sims cannot nest SET LOCAL with DO-block DDL on one adapter pool).
   */
  skipAdvisoryLock?: boolean;
  /**
   * When true, skip PL/pgSQL {@link PostgresSqliteCompatMigration}.
   * Use for pg-mem where JSON1 shims are installed via
   * `installPgMemSqliteCompat` at `createPgMemSqlClient` time.
   */
  skipSqliteCompat?: boolean;
};

export class PostgresMigrationRunner {
  constructor(private readonly deps: PostgresMigrationRunnerDeps) {}

  async run(): Promise<void> {
    const {
      sqlClient,
      pool,
      logger,
      dbScope,
      betterAuthBaseURL,
      betterAuthSecret,
      skipAdvisoryLock = false,
      skipSqliteCompat = false,
    } = this.deps;

    const locked = new ComposedDatabaseMigration()
      .register(new HardCutoverDropLegacyTablesMigration())
      .register(new SyncEngineDatabaseMigration())
      .register(new OutboxDatabaseMigration())
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
    // JSON1 shims so app SQL stays SQLite-shaped on Postgres (not pg-mem).
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
        new BetterAuthDatabaseMigration({
          database: { kind: 'postgres', pool },
          secret: betterAuthSecret,
          baseURL: betterAuthBaseURL,
        })
      )
      .register(new PurgeClerkExternalAccountsMigration());

    await databaseMigration.migrate({ sqlClient, logger });
  }
}
