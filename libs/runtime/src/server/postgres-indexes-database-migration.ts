import { APP_QUERIES } from '@libs/runtime/root/app-queries';
import { assert } from '@pkgs/assert';
import type { Clock } from '@pkgs/clock';
import { reconcileIndexes } from '@pkgs/db-indexes';
import { createPostgresPort } from '@pkgs/db-indexes/postgres';
import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import { extractWorkload } from '@pkgs/sync-engine/shared';

export type PostgresIndexesDatabaseMigrationOptions = {
  readonly clock: Clock;
  readonly deadlineMs?: number;
};

/**
 * Post-schema workload index reconcile. Must run **outside** the advisory-locked
 * migrate transaction so CREATE INDEX CONCURRENTLY is legal.
 */
export class PostgresIndexesDatabaseMigration implements DatabaseMigration {
  private readonly clock: Clock;
  private readonly deadlineMs: number;

  constructor(options: PostgresIndexesDatabaseMigrationOptions) {
    assert.ok(options.clock !== undefined, 'clock required');
    this.clock = options.clock;
    this.deadlineMs = options.deadlineMs ?? 120_000;
    assert.ok(this.deadlineMs > 0, 'deadlineMs > 0');
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    const manifest = await extractWorkload(APP_QUERIES);
    const db = createPostgresPort(ctx.sqlClient, { clock: this.clock });
    const report = await reconcileIndexes({
      manifest,
      db,
      clock: this.clock,
      deadlineMs: this.deadlineMs,
    });
    ctx.logger.info('autoidx reconcile complete', {
      desired: report.plan.desired.length,
      completed: report.completed.length,
      deferred: report.deferred.length,
      remaining: report.remaining.length,
      notes: report.notes,
    });
  }
}
