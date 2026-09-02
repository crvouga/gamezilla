import { APP_QUERIES } from '@libs/runtime/root/app-queries';
import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { MIGRATE_RECONCILE_CONFIG, resolveConfig } from '@pkgs/db-indexes';
import { createPostgresPort } from '@pkgs/db-indexes/postgres';
import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { extractWorkload } from '@pkgs/sync-engine/shared';
import { runMigrateIndexReconcile } from './run-migrate-index-reconcile';

export type PostgresIndexesDatabaseMigrationOptions = {
  readonly clock: Clock;
  /** Override per-round deadline (defaults to migrate preset). */
  readonly deadlineMs?: number;
};

/**
 * Post-schema workload index reconcile. Must run **outside** the advisory-locked
 * migrate transaction so CREATE INDEX CONCURRENTLY is legal.
 *
 * Uses the migrate-complete preset (no row/improvement gates, large build budget)
 * and loops until the desired set is applied — or throws if actions fail / remain.
 */
export class PostgresIndexesDatabaseMigration implements DatabaseMigration {
  private readonly clock: Clock;
  private readonly deadlineMs: number;

  constructor(options: PostgresIndexesDatabaseMigrationOptions) {
    assert.ok(options.clock !== undefined, 'clock required');
    this.clock = options.clock;
    const migrateConfig = resolveConfig(MIGRATE_RECONCILE_CONFIG);
    this.deadlineMs = options.deadlineMs ?? migrateConfig.defaultDeadlineMs;
    assert.ok(this.deadlineMs > 0, 'deadlineMs > 0');
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const manifest = await extractWorkload(APP_QUERIES);
    const db = createPostgresPort(ctx.sqlClient, { clock: this.clock });
    await runMigrateIndexReconcile({
      manifest,
      db,
      clock: this.clock,
      logger: ctx.logger,
      deadlineMs: this.deadlineMs,
    });
  }
}
