/**
 * Idempotent reconciliation between the {@link FrozenEntitySchemaRegistry}
 * (source of truth) and the live Postgres catalog.
 *
 * Every `db:migrate` run leaves Postgres in lock-step with the registry,
 * with no row data loss in `patches` and no destructive drops of per-entity
 * tables that the registry still claims:
 *
 *   0. Detect a legacy partitioned `snapshots` (pre-architectural-pivot)
 *      and DROP CASCADE it. The previous declarative-partitioning design
 *      forced every partition to share the parent's columns, causing
 *      generated-column bloat. After this one-time cleanup, snapshots
 *      regenerate lazily from `patches` via `recomputeTouchedSnapshots`
 *      on the next write to each entity; `patches` itself is untouched.
 *   1. Apply the base DDL ({@link MIGRATIONS}) — only `patches` + its
 *      btrees now; per-entity snapshot tables + their indexes + the
 *      `snapshots` view are 100% reconciler-managed.
 *   2. Compute the desired Postgres layout from the registry
 *      ({@link computeDesiredPgLayout}).
 *   3. Introspect the live layout from the catalog
 *      ({@link introspectPgLayout}).
 *   4. Diff the two ({@link diffPgLayout}) and apply the smallest set of
 *      DDL needed to converge ({@link applyPgLayoutDiff}).
 *
 * What the reconciler manages vs leaves alone is defined by the ownership
 * namespaces in {@link ./partitioning} (`snapshots__*`, `gc_*`,
 * `gc_*_idx`, `pdb_cidx_*`, `pdb_gin_*`, and the `snapshots` view).
 * Anything outside those prefixes is invisible to introspection and
 * untouched by the reconciler.
 *
 * Per-entity-table lifecycle: tables are **additive only**. A registered
 * entity type that doesn't yet have a `snapshots__<slug>` table gets one
 * created; a table whose entity type is no longer in the registry is
 * logged as orphaned but kept (the rows inside are user data — drop
 * manually if you really want them gone).
 */
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { FrozenEntitySchemaRegistry } from '../schema/entity-schema-registry';
import { introspectPgLayout, probeSnapshotsRelKind } from './pg-introspect';
import { computeDesiredPgLayout } from './pg-layout';
import { applyPgLayoutDiff, diffPgLayout } from './pg-reconcile';
import { MIGRATIONS } from './sql-constants';

async function dropLegacyPartitionedSnapshotsIfPresent(
  sqlClient: SqlClient,
  log: Logger
): Promise<void> {
  const kind = await probeSnapshotsRelKind(sqlClient);
  if (kind !== 'partitioned') return;
  log.warn(
    'patch-db postgres migrate: dropping legacy partitioned `snapshots` (data lost; snapshots are derived state and refill from patches lazily)'
  );
  await sqlClient.run('DROP TABLE IF EXISTS snapshots CASCADE');
}

async function applyBaseDdl(sqlClient: SqlClient, log: Logger): Promise<void> {
  const statements = MIGRATIONS.split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  log.info('patch-db postgres migrate: applying base ddl', {
    statementCount: statements.length,
  });
  for (const stmt of statements) {
    await sqlClient.run(stmt);
  }
}

/**
 * Entry point used by `PatchDbImplPostgres.migrate`. Detects + nukes any
 * legacy partitioned snapshots cluster, applies idempotent base DDL, then
 * reconciles registry-derived per-entity tables / generated columns /
 * single + composite btrees / GINs / the `snapshots` view against the
 * live catalog.
 *
 * Safe to run on a populated DB: `patches` is never touched destructively;
 * only reconciler-owned objects in the patch-db namespaces converge.
 */
export async function migratePatchDbPostgres(args: {
  sqlClient: SqlClient;
  logger: Logger;
  /**
   * Frozen schema registry. When supplied, the reconciler converges every
   * registered entity type's `snapshots__<slug>` table + typed generated
   * columns + per-table single + composite btrees + GIN + the `snapshots`
   * UNION ALL view against the live catalog. Without a registry, only the
   * base DDL (patches + btrees) runs.
   */
  registry?: FrozenEntitySchemaRegistry;
}): Promise<void> {
  const log = args.logger.child({ migration: 'patch-db-postgres' });
  log.info('patch-db postgres migrate: start');
  try {
    await dropLegacyPartitionedSnapshotsIfPresent(args.sqlClient, log);
    await applyBaseDdl(args.sqlClient, log);
    if (args.registry !== undefined) {
      const desired = computeDesiredPgLayout(args.registry);
      const live = await introspectPgLayout(args.sqlClient);
      const diff = diffPgLayout(desired, live);
      await applyPgLayoutDiff(args.sqlClient, diff, args.logger);
    }
    log.info('patch-db postgres migrate: complete');
  } catch (error) {
    log.error('patch-db postgres migrate: failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
