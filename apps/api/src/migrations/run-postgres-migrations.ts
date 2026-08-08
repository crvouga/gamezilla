/**
 * Canonical Postgres migration order: compose {@link DatabaseMigration}
 * units (ensure schema → advisory-locked framework/domain/kv/entity_store →
 * Better Auth → purge Clerk links).
 */

import { appSchema } from '@libs/db/shared/app-schema';
import { BetterAuthDatabaseMigration } from '@pkgs/auth-better-auth/server';
import {
  ComposedDatabaseMigration,
  PostgresAdvisoryLockedTransactionMigration,
} from '@pkgs/db-migrate';
import { PostgresSchemaDatabaseMigration } from '@pkgs/db-schema/postgres';

import { EntityStorePostgresDatabaseMigration } from '@pkgs/entity-store/postgres-database-migration';
import { KvPostgresDatabaseMigration } from '@pkgs/kv/postgres-database-migration';
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { EnsurePostgresSchemaMigration } from '@pkgs/sql-client/postgres/ensure-postgres-schema-migration';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres/schema';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import { PurgeClerkExternalAccountsMigration } from './purge-clerk-external-accounts-migration';

/**
 * Session/transaction advisory lock for `api:migrate`. Serializes concurrent
 * CI jobs (check-api + check-browser) against the shared hosted dev Postgres so
 * they wait instead of thrashing on DDL `lock_timeout`. Distinct from the
 * matchmaking tick lock id.
 */
export const API_MIGRATE_ADVISORY_LOCK_ID = '872014001234567890';

export type RunPostgresMigrationsArgs = {
  sqlClient: SqlClient;
  /** Pinned pool for Better Auth Kysely migrations (same TCP session). */
  pool: Pool;
  logger: Logger;
  dbScope: PostgresDbScope;
  /** Used as Better Auth baseURL during migrate (placeholder OK). */
  betterAuthBaseURL: string;
  betterAuthSecret: string;
};

export async function runPostgresMigrations(
  args: RunPostgresMigrationsArgs
): Promise<void> {
  const {
    sqlClient,
    pool,
    logger,
    dbScope,
    betterAuthBaseURL,
    betterAuthSecret,
  } = args;

  const locked = new ComposedDatabaseMigration()
    .register(new SyncEngineDatabaseMigration())
    .register(
      new PostgresSchemaDatabaseMigration(appSchema, dbScope, {
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      })
    )
    .register(new KvPostgresDatabaseMigration())
    .register(new EntityStorePostgresDatabaseMigration());

  const databaseMigration = new ComposedDatabaseMigration()
    .register(new EnsurePostgresSchemaMigration(dbScope))
    .register(
      new PostgresAdvisoryLockedTransactionMigration({
        lockId: API_MIGRATE_ADVISORY_LOCK_ID,
        inner: locked,
      })
    )
    .register(
      new BetterAuthDatabaseMigration({
        database: pool,
        secret: betterAuthSecret,
        baseURL: betterAuthBaseURL,
      })
    )
    .register(new PurgeClerkExternalAccountsMigration());

  await databaseMigration.migrate({ sqlClient, logger });
}
