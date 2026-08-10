import { raw, sql } from '@pkgs/sql';

import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from './database-migration';

export type PostgresAdvisoryLockedTransactionMigrationArgs = {
  /** Postgres advisory lock id (bigint-compatible string or number). */
  readonly lockId: string | number | bigint;
  readonly inner: DatabaseMigration;
};

/**
 * Opens a transaction, acquires `pg_advisory_xact_lock`, then runs `inner`
 * with the transaction client. Used to serialize concurrent migrates (e.g. CI).
 */
export class PostgresAdvisoryLockedTransactionMigration
  implements DatabaseMigration
{
  private readonly lockId: string;
  private readonly inner: DatabaseMigration;

  constructor(args: PostgresAdvisoryLockedTransactionMigrationArgs) {
    this.lockId = String(args.lockId);
    this.inner = args.inner;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const { sqlClient, logger } = ctx;
    await sqlClient.transaction(async (tx) => {
      // Wait unbounded for the migrate mutex (other CI migrates). DDL
      // lock_timeout is set after the advisory lock is held (see below).
      // (Do not set deadlock_timeout: hosted Postgres often denies it.)
      await tx.run(raw("SET LOCAL lock_timeout = '0'"));
      logger.info('acquiring migrate advisory lock');
      await tx.run(
        sql<void>`
          SELECT pg_advisory_xact_lock(
            ${this.lockId}::bigint
          ) AS locked`
      );
      logger.info('migrate advisory lock acquired');
      // Keep DDL lock waits bounded so a wedged backend fails into migrate-db
      // retries rather than hanging the job indefinitely.
      await tx.run(raw("SET LOCAL lock_timeout = '5min'"));
      await this.inner.migrate({ sqlClient: tx, logger });
    });
  }
}
