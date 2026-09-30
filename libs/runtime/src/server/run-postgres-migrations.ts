import { BillingCustomerLinkProviderMigration } from '@libs/billing/root/server/billing-customer-link-provider-migration';
import { ProfileUsernameIntegrityMigration } from '@libs/profile/root/server/profile-username-integrity-migration';
import { appSchema } from '@libs/runtime/root/app-schema';
import { APP_AUTH_PROVIDER } from '@libs/runtime/root/server/app-auth-provider';
import type { Clock } from '@pkgs/clock';
import {
  ComposedDatabaseMigration,
  type DatabaseMigration,
  EnsurePostgresSchemaMigration,
  PostgresAdvisoryLockedTransactionMigration,
} from '@pkgs/db-migrate';
import {
  PostgresSchemaDatabaseMigration,
  PostgresSchemaIndexReconcileMigration,
} from '@pkgs/db-schema-postgres';
import { EntityStorePostgresDatabaseMigration } from '@pkgs/entity-store/postgres-database-migration';
import { KvPostgresDatabaseMigration } from '@pkgs/kv-postgres/postgres-database-migration';
import type { Logger } from '@pkgs/logger';
import { OutboxDatabaseMigration } from '@pkgs/outbox';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SyncEngineDatabaseMigration } from '@pkgs/sync-engine/shared';
import { CutoverLegacyAuthToIdpMigration } from './cutover-legacy-auth-to-idp-migration';
import { GrantObsReadMigration } from './grant-obs-read-migration';
import { DomainSchemaIntegerWidthMigration } from './domain-schema-integer-width-migration';
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
/**
 * The tables the auth service keeps in this database, if it keeps any (a
 * self-hosted IdP does; a hosted service does not).
 */
function authServiceMigration(dbScope: PostgresDbScope): DatabaseMigration {
  return (
    APP_AUTH_PROVIDER.postgresMigration?.({ dbScope }) ?? {
      migrate: () => Promise.resolve(),
    }
  );
}

export const POSTGRES_MIGRATE_ADVISORY_LOCK_ID = '872014001234567890';

export type PostgresMigrationRunnerDeps = {
  sqlClient: SqlClient;
  logger: Logger;
  dbScope: PostgresDbScope;
  /**
   * When true, skip `pg_advisory_xact_lock` + outer transaction (mockingbird-postgres /
   * single-process harnesses cannot nest SET LOCAL with DO-block DDL on one adapter pool).
   */
  skipAdvisoryLock?: boolean;
  /**
   * When true, skip PL/pgSQL {@link PostgresSqliteCompatMigration}.
   * Use when JSON1 shims are installed at SqlClient open time (mockingbird-postgres).
   */
  skipSqliteCompat?: boolean;
  /**
   * When true, skip workload {@link PostgresIndexesDatabaseMigration}.
   * Defaults to true when `skipAdvisoryLock` (harness / mockingbird-postgres).
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
      .register(new DomainSchemaIntegerWidthMigration(appSchema.snapshot()))
      .register(new ProfileUsernameIntegrityMigration())
      .register(
        new PostgresSchemaDatabaseMigration(appSchema, dbScope, {
          skipAdvisoryLock: true,
          alreadyInTransaction: !skipAdvisoryLock,
          // When the concurrent index phase below is registered, it owns every
          // appSchema index; otherwise this call must create them itself.
          indexPhase: skipIndexReconcile ? 'inline' : 'skip',
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
      .register(authServiceMigration(dbScope))
      .register(new CutoverLegacyAuthToIdpMigration())
      .register(new PurgeClerkExternalAccountsMigration())
      .register(new BillingCustomerLinkProviderMigration())
      .register(new GrantObsReadMigration());

    // Index builds must run outside the advisory-locked transaction so every
    // build is CONCURRENTLY and no long lock is held on a live table.
    if (!skipIndexReconcile) {
      databaseMigration.register(
        new PostgresSchemaIndexReconcileMigration(appSchema, dbScope)
      );
    }

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
