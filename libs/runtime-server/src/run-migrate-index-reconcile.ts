import { assert } from '@pkgs/assert-shared/singleton';
import type { Clock } from '@pkgs/clock-shared/types';
import type { DbPort, WorkloadManifest } from '@pkgs/db-indexes-shared/types';
import { MIGRATE_RECONCILE_CONFIG, resolveConfig } from '@pkgs/db-indexes-shared/config';
import { reconcileIndexes } from '@pkgs/db-indexes-shared/reconcile';
import type { Logger } from '@pkgs/logger-shared/logger';

/** Hard cap on reconcile rounds so a stuck deferred loop cannot hang forever. */
export const MAX_MIGRATE_RECONCILE_ROUNDS = 64;

export type RunMigrateIndexReconcileArgs = {
  readonly manifest: WorkloadManifest;
  readonly db: DbPort;
  readonly clock: Clock;
  readonly logger: Logger;
  /** Override per-round deadline (defaults to migrate preset). */
  readonly deadlineMs?: number;
  /** Override round cap (tests). */
  readonly maxRounds?: number;
};

/**
 * Apply the full desired autoidx set using the migrate-complete preset.
 * Loops until remaining/deferred are empty; throws on failed actions or stall.
 */
export async function runMigrateIndexReconcile(
  args: RunMigrateIndexReconcileArgs
): Promise<void> {
  assert.ok(args.manifest !== undefined, 'manifest required');
  assert.ok(args.db !== undefined, 'db required');
  assert.ok(args.clock !== undefined, 'clock required');
  const migrateConfig = resolveConfig(MIGRATE_RECONCILE_CONFIG);
  const deadlineMs = args.deadlineMs ?? migrateConfig.defaultDeadlineMs;
  assert.ok(deadlineMs > 0, 'deadlineMs > 0');
  const maxRounds = args.maxRounds ?? MAX_MIGRATE_RECONCILE_ROUNDS;
  assert.ok(maxRounds >= 1, 'maxRounds >= 1');

  let round = 0;
  let lastDesired = 0;
  let lastCompleted = 0;
  let lastDeferred = 0;
  let lastRemaining = 0;
  let lastNotes: readonly string[] = [];

  while (round < maxRounds) {
    round += 1;
    const report = await reconcileIndexes({
      manifest: args.manifest,
      db: args.db,
      clock: args.clock,
      config: MIGRATE_RECONCILE_CONFIG,
      deadlineMs,
    });
    lastDesired = report.plan.desired.length;
    lastCompleted = report.completed.length;
    lastDeferred = report.deferred.length;
    lastRemaining = report.remaining.length;
    lastNotes = report.notes;

    if (report.failed.length > 0) {
      const reasons = report.failed
        .map((f) => `${f.action.name}: ${f.reason}`)
        .join('; ');
      throw new Error(
        `autoidx reconcile failed (${String(report.failed.length)} action(s)): ${reasons}`
      );
    }

    if (report.remaining.length === 0 && report.deferred.length === 0) {
      args.logger.info('autoidx reconcile complete', {
        rounds: round,
        desired: lastDesired,
        completed: lastCompleted,
        deferred: lastDeferred,
        remaining: lastRemaining,
        notes: lastNotes,
      });
      return;
    }

    if (report.completed.length === 0) {
      if (report.deferred.length > 0) {
        const deferred = report.deferred
          .map((a) => `${a.kind} ${a.name}`)
          .join(', ');
        throw new Error(
          `autoidx reconcile stuck with deferred actions and no progress: ${deferred}`
        );
      }
      throw new Error(
        `autoidx reconcile made no progress with remaining=${String(report.remaining.length)}`
      );
    }
  }

  throw new Error(
    `autoidx reconcile did not finish after ${String(maxRounds)} rounds ` +
      `(desired=${String(lastDesired)} remaining=${String(lastRemaining)} ` +
      `deferred=${String(lastDeferred)})`
  );
}
