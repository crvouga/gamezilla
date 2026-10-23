import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { assertWithinLimit, LIMITS } from './limits';

export type Config = {
  readonly maxIndexesPerTable: number;
  readonly minImprovementFactor: number;
  readonly minTableRows: number;
  /**
   * When true (default), candidates whose hypopg/EXPLAIN improvement is below
   * {@link minImprovementFactor} are skipped. Migrate-complete mode sets this
   * false so empty/fresh DBs still get the desired autoidx set.
   */
  readonly requireEvalImprovement: boolean;
  readonly deprecationWindowDays: number;
  readonly maxBuildsPerRun: number;
  readonly maxIncludeColumns: number;
  readonly defaultDeadlineMs: number;
  readonly createEstimatedMs: number;
  readonly dropEstimatedMs: number;
  readonly metaEstimatedMs: number;
  readonly sqliteMaxOnlineBuildRows: number;
  readonly sqliteMaxCopyBytes: number;
};

export const DEFAULT_CONFIG: Config = Object.freeze({
  maxIndexesPerTable: 6,
  minImprovementFactor: 3,
  minTableRows: 10_000,
  requireEvalImprovement: true,
  deprecationWindowDays: 30,
  maxBuildsPerRun: 3,
  maxIncludeColumns: 3,
  defaultDeadlineMs: 120_000,
  createEstimatedMs: 30_000,
  dropEstimatedMs: 10_000,
  metaEstimatedMs: 100,
  sqliteMaxOnlineBuildRows: 100_000,
  sqliteMaxCopyBytes: 512 * 1024 * 1024,
});

/**
 * Migrate-complete preset: apply the full desired autoidx set (after prefix
 * consolidation + per-table budget) regardless of row count or EXPLAIN
 * improvement. Used by reconcilePostgres workload index reconcile.
 */
export const MIGRATE_RECONCILE_CONFIG: Partial<Config> = Object.freeze({
  minTableRows: 0,
  requireEvalImprovement: false,
  maxBuildsPerRun: LIMITS.maxPlanActions,
  defaultDeadlineMs: 30 * 60 * 1000,
});

export function resolveConfig(partial?: Partial<Config>): Config {
  assert.ok(
    partial === undefined || typeof partial === 'object',
    'config must be an object or undefined'
  );
  const merged: Config = { ...DEFAULT_CONFIG, ...partial };
  assertWithinLimit(
    merged.maxIndexesPerTable,
    LIMITS.maxCandidatesPerStatement,
    'config.maxIndexesPerTable'
  );
  assert.ok(
    merged.minImprovementFactor >= 1,
    'config.minImprovementFactor must be >= 1'
  );
  assert.ok(merged.minTableRows >= 0, 'config.minTableRows must be >= 0');
  assert.ok(
    typeof merged.requireEvalImprovement === 'boolean',
    'config.requireEvalImprovement must be boolean'
  );
  assert.ok(
    merged.deprecationWindowDays >= 0,
    'config.deprecationWindowDays must be >= 0'
  );
  assert.ok(merged.maxBuildsPerRun >= 1, 'config.maxBuildsPerRun must be >= 1');
  assertWithinLimit(
    merged.maxIncludeColumns,
    LIMITS.maxIncludeColumns,
    'config.maxIncludeColumns'
  );
  assert.ok(
    merged.defaultDeadlineMs > 0,
    'config.defaultDeadlineMs must be > 0'
  );
  return Object.freeze(merged);
}

export function deprecationWindowMs(config: Config): number {
  assert.ok(config.deprecationWindowDays >= 0, 'deprecationWindowDays >= 0');
  return config.deprecationWindowDays * 24 * 60 * 60 * 1000;
}
