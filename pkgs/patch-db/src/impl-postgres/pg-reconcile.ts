/**
 * Idempotent diff-and-converge between the registry-derived
 * {@link DesiredPgLayout} and the catalog-derived {@link LivePgLayout}.
 *
 * Per-entity standalone tables (`snapshots__<slug>`) carry ONLY their own
 * typed columns + indexes — there is no partitioned parent forcing every
 * table to share a schema. Cross-entity reads go through the `snapshots`
 * VIEW that this module rebuilds (`DROP VIEW + CREATE VIEW`) at the end
 * of every reconcile so its branch list matches the live desired set.
 *
 * Apply order (matters for correctness):
 *   1. DROP the live `snapshots` relation (view or legacy table, if any).
 *      The view depends on the per-entity tables, so dropping it first
 *      releases the dependency edges that would otherwise block ALTER
 *      TABLE / DROP COLUMN on those tables.
 *   2. CREATE missing per-entity tables. Each is a plain `CREATE TABLE
 *      IF NOT EXISTS` with a `CHECK (entity_type = '<lit>')` constraint
 *      so the `UNION ALL` view supports constraint exclusion.
 *   3. DROP orphaned generated columns table-by-table (cascade drops the
 *      `_idx` btree on the same column).
 *   4. ADD missing generated columns table-by-table.
 *   5. DROP orphaned single + composite + GIN btrees we still recognise.
 *   6. CREATE missing GIN indexes (`pdb_gin_<slug>__attrs`).
 *   7. CREATE missing single + composite btrees.
 *   8. CREATE `snapshots` view: `SELECT … UNION ALL …` over every desired
 *      per-entity table. An empty registry produces no view; that's
 *      correct — `FROM snapshots` would then be an error, exactly like
 *      querying any nonexistent relation.
 *   9. Warn for every live `snapshots__<slug>` table whose entity type
 *      isn't in the registry. Per-entity tables are never auto-dropped
 *      (the rows inside are user data — manual `DROP TABLE` required).
 */
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { assertSqlIdentifier } from '@pkgs/sql';
import {
  generatedColumnExpression,
  quoteSqlString,
} from './migrate-partitions';
import type {
  DesiredCompositeIndex,
  DesiredEntityTable,
  DesiredPgLayout,
} from './pg-layout';
import { dropSnapshotsRelIfPresent, type LivePgLayout } from './pg-introspect';
import type { GeneratedColumnSpec } from './partitioning';
import { PATCH_DB_SNAPSHOTS_VIEW_NAME, pgColumnTypeFor } from './partitioning';
import {
  type CompositeIndexOnTable,
  diffCompositeIndexes,
  diffGeneratedColumns,
  diffGinIndexes,
  diffSingleIndexes,
  diffTables,
  type GeneratedColumnDropsOnTable,
  type GeneratedColumnsOnTable,
  type GinIndexOnTable,
  type IndexRefOnTable,
  type SingleIndexOnTable,
  viewBranchesOf,
} from './pg-reconcile-diff';

export type {
  CompositeIndexOnTable,
  GeneratedColumnDropsOnTable,
  GeneratedColumnsOnTable,
  GinIndexOnTable,
  IndexRefOnTable,
  SingleIndexOnTable,
} from './pg-reconcile-diff';

export type PgLayoutDiff = {
  /** `snapshots__<slug>` tables to create. */
  readonly tablesToCreate: readonly DesiredEntityTable[];
  /** Live tables whose entity type is not in the registry (orphaned). */
  readonly orphanedTableNames: readonly string[];

  /** Generated columns to add, grouped by their owning table. */
  readonly generatedColumnsToAdd: readonly GeneratedColumnsOnTable[];
  /** Generated columns to drop, grouped by their owning table. */
  readonly generatedColumnsToDrop: readonly GeneratedColumnDropsOnTable[];

  /** Per-table single-column btrees to add. */
  readonly singleIndexesToAdd: readonly SingleIndexOnTable[];
  /** Per-table single-column btrees to drop. */
  readonly singleIndexesToDrop: readonly IndexRefOnTable[];

  /** Per-table composite btrees to add. */
  readonly compositeIndexesToAdd: readonly CompositeIndexOnTable[];
  /** Per-table composite btrees to drop. */
  readonly compositeIndexesToDrop: readonly IndexRefOnTable[];

  /** Per-table GIN indexes to add. */
  readonly ginIndexesToAdd: readonly GinIndexOnTable[];
  /** Per-table GIN indexes to drop. */
  readonly ginIndexesToDrop: readonly IndexRefOnTable[];

  /** Desired tables in deterministic order — used to rebuild the view. */
  readonly viewBranches: readonly DesiredEntityTable[];
};

export type PgLayoutDiffSummary = {
  readonly tablesCreated: number;
  readonly orphanedTablesKept: number;
  readonly generatedColumnsAdded: number;
  readonly generatedColumnsDropped: number;
  readonly singleIndexesAdded: number;
  readonly singleIndexesDropped: number;
  readonly compositeIndexesAdded: number;
  readonly compositeIndexesDropped: number;
  readonly ginIndexesAdded: number;
  readonly ginIndexesDropped: number;
  readonly viewBranchCount: number;
};

/**
 * Pure: diffs the desired layout against the live introspection result.
 * Independent of any DB connection; fully unit-testable.
 */
export function diffPgLayout(
  desired: DesiredPgLayout,
  live: LivePgLayout
): PgLayoutDiff {
  const tables = diffTables(desired, live);
  const generatedColumns = diffGeneratedColumns(desired, live);
  const singleIndexes = diffSingleIndexes(desired, live);
  const compositeIndexes = diffCompositeIndexes(desired, live);
  const ginIndexes = diffGinIndexes(desired, live);
  return {
    tablesToCreate: tables.toCreate,
    orphanedTableNames: tables.orphaned,
    generatedColumnsToAdd: generatedColumns.toAdd,
    generatedColumnsToDrop: generatedColumns.toDrop,
    singleIndexesToAdd: singleIndexes.toAdd,
    singleIndexesToDrop: singleIndexes.toDrop,
    compositeIndexesToAdd: compositeIndexes.toAdd,
    compositeIndexesToDrop: compositeIndexes.toDrop,
    ginIndexesToAdd: ginIndexes.toAdd,
    ginIndexesToDrop: ginIndexes.toDrop,
    viewBranches: viewBranchesOf(desired),
  };
}

function dropColumnClauseFor(columnName: string): string {
  assertSqlIdentifier(columnName, 'dropColumnClauseFor: columnName');
  return `DROP COLUMN IF EXISTS ${columnName} CASCADE`;
}

function addColumnClauseFor(spec: GeneratedColumnSpec): string {
  assertSqlIdentifier(spec.columnName, 'addColumnClauseFor: columnName');
  const colType = pgColumnTypeFor(spec.dataType);
  return `ADD COLUMN ${spec.columnName} ${colType} GENERATED ALWAYS AS ${generatedColumnExpression(spec)} STORED`;
}

async function createMissingTables(
  sqlClient: SqlClient,
  tables: readonly DesiredEntityTable[]
): Promise<void> {
  for (const table of tables) {
    const tableName = String(table.tableName);
    assertSqlIdentifier(tableName, 'createMissingTables: tableName');
    const check = quoteSqlString(table.entityType);
    await sqlClient.run(
      `CREATE TABLE IF NOT EXISTS ${tableName} (
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        attributes JSONB NOT NULL DEFAULT '{}',
        PRIMARY KEY (entity_type, entity_id),
        CHECK (entity_type = ${check})
      )`
    );
  }
}

async function dropOrphanedGeneratedColumns(
  sqlClient: SqlClient,
  batches: readonly GeneratedColumnDropsOnTable[]
): Promise<void> {
  for (const batch of batches) {
    if (batch.columnNames.length === 0) continue;
    assertSqlIdentifier(
      batch.tableName,
      'dropOrphanedGeneratedColumns: tableName'
    );
    const clauses = batch.columnNames.map((n) => dropColumnClauseFor(n));
    await sqlClient.run(`ALTER TABLE ${batch.tableName} ${clauses.join(', ')}`);
  }
}

async function addMissingGeneratedColumns(
  sqlClient: SqlClient,
  batches: readonly GeneratedColumnsOnTable[]
): Promise<void> {
  for (const batch of batches) {
    if (batch.specs.length === 0) continue;
    assertSqlIdentifier(
      batch.tableName,
      'addMissingGeneratedColumns: tableName'
    );
    const clauses = batch.specs.map((spec) => addColumnClauseFor(spec));
    await sqlClient.run(`ALTER TABLE ${batch.tableName} ${clauses.join(', ')}`);
  }
}

async function dropIndexes(
  sqlClient: SqlClient,
  refs: readonly IndexRefOnTable[]
): Promise<void> {
  for (const ref of refs) {
    assertSqlIdentifier(ref.indexName, 'dropIndexes: indexName');
    await sqlClient.run(`DROP INDEX IF EXISTS ${ref.indexName}`);
  }
}

async function createSingleIndexes(
  sqlClient: SqlClient,
  refs: readonly SingleIndexOnTable[]
): Promise<void> {
  for (const ref of refs) {
    assertSqlIdentifier(ref.tableName, 'createSingleIndexes: tableName');
    assertSqlIdentifier(ref.spec.indexName, 'createSingleIndexes: indexName');
    assertSqlIdentifier(ref.spec.columnName, 'createSingleIndexes: columnName');
    await sqlClient.run(
      `CREATE INDEX IF NOT EXISTS ${ref.spec.indexName} ON ${ref.tableName} (${ref.spec.columnName})`
    );
  }
}

async function createGinIndexes(
  sqlClient: SqlClient,
  refs: readonly GinIndexOnTable[]
): Promise<void> {
  for (const ref of refs) {
    assertSqlIdentifier(ref.tableName, 'createGinIndexes: tableName');
    assertSqlIdentifier(ref.indexName, 'createGinIndexes: indexName');
    await sqlClient.run(
      `CREATE INDEX IF NOT EXISTS ${ref.indexName} ON ${ref.tableName} USING GIN (attributes jsonb_path_ops)`
    );
  }
}

function compositeColumnsClause(spec: DesiredCompositeIndex): string {
  return spec.columns
    .map((col) => {
      assertSqlIdentifier(col.columnName, 'compositeColumnsClause: columnName');
      const dir = col.direction === 'desc' ? 'DESC' : 'ASC';
      return `${col.columnName} ${dir}`;
    })
    .join(', ');
}

function compositeWhereClause(spec: DesiredCompositeIndex): string {
  if (spec.wherePredicates.length === 0) return '';
  const parts = spec.wherePredicates.map((p) => {
    assertSqlIdentifier(p.columnName, 'compositeWhereClause: columnName');
    return `${p.columnName} IS NOT NULL`;
  });
  return ` WHERE ${parts.join(' AND ')}`;
}

async function createCompositeIndexes(
  sqlClient: SqlClient,
  refs: readonly CompositeIndexOnTable[]
): Promise<void> {
  for (const ref of refs) {
    assertSqlIdentifier(ref.tableName, 'createCompositeIndexes: tableName');
    assertSqlIdentifier(
      ref.spec.indexName,
      'createCompositeIndexes: indexName'
    );
    const unique = ref.spec.unique ? 'UNIQUE ' : '';
    const cols = compositeColumnsClause(ref.spec);
    const where = compositeWhereClause(ref.spec);
    await sqlClient.run(
      `CREATE ${unique}INDEX IF NOT EXISTS ${ref.spec.indexName} ON ${ref.tableName} (${cols})${where}`
    );
  }
}

/** Builds the `SELECT entity_id, entity_type, attributes FROM <table>`
 *  branches used inside the `UNION ALL` view body. */
function buildViewBody(branches: readonly DesiredEntityTable[]): string {
  const selects = branches.map((b) => {
    const tableName = String(b.tableName);
    assertSqlIdentifier(tableName, 'buildViewBody: tableName');
    return `SELECT entity_id, entity_type, attributes FROM ${tableName}`;
  });
  return selects.join('\nUNION ALL\n');
}

/**
 * Rebuilds the `snapshots` view as `UNION ALL` over every desired
 * per-entity table. We `DROP VIEW + CREATE VIEW` (rather than `CREATE OR
 * REPLACE VIEW`) because rebuilds from the registry can add or remove
 * branches, and `OR REPLACE` rejects column-list changes — but in our
 * case every branch has the same `(entity_id, entity_type, attributes)`
 * column list, so the failure mode is theoretical. We still prefer the
 * drop-and-create idiom because it leaves a clean catalog after `DROP
 * VIEW IF EXISTS` ran in step 1 anyway, and skipping the recreate when
 * there are no branches is the correct behaviour for an empty registry
 * (no `snapshots` symbol survives — `FROM snapshots` should be a hard
 * error).
 */
async function rebuildSnapshotsView(
  sqlClient: SqlClient,
  branches: readonly DesiredEntityTable[]
): Promise<void> {
  if (branches.length === 0) return;
  const body = buildViewBody(branches);
  await sqlClient.run(
    `CREATE VIEW ${PATCH_DB_SNAPSHOTS_VIEW_NAME} AS\n${body}`
  );
}

function warnOnOrphanedTables(
  logger: Logger,
  orphaned: readonly string[]
): void {
  for (const name of orphaned) {
    logger.warn(
      'patch-db reconcile: orphaned per-entity snapshot table (entity type not in registry) — kept; drop manually if intentional',
      { table: name }
    );
  }
}

function sumGeneratedColumnChanges(
  batches: readonly {
    columnNames?: readonly string[];
    specs?: readonly GeneratedColumnSpec[];
  }[]
): number {
  let n = 0;
  for (const b of batches) {
    n += b.columnNames?.length ?? b.specs?.length ?? 0;
  }
  return n;
}

export async function applyPgLayoutDiff(
  sqlClient: SqlClient,
  diff: PgLayoutDiff,
  logger: Logger
): Promise<PgLayoutDiffSummary> {
  const log = logger.child({ migration: 'patch-db-postgres-reconcile' });
  const generatedColumnsAdded = sumGeneratedColumnChanges(
    diff.generatedColumnsToAdd
  );
  const generatedColumnsDropped = sumGeneratedColumnChanges(
    diff.generatedColumnsToDrop
  );
  log.info('patch-db reconcile: start', {
    tablesToCreate: diff.tablesToCreate.length,
    orphanedTables: diff.orphanedTableNames.length,
    generatedColumnsToAdd: generatedColumnsAdded,
    generatedColumnsToDrop: generatedColumnsDropped,
    singleIndexesToAdd: diff.singleIndexesToAdd.length,
    singleIndexesToDrop: diff.singleIndexesToDrop.length,
    compositeIndexesToAdd: diff.compositeIndexesToAdd.length,
    compositeIndexesToDrop: diff.compositeIndexesToDrop.length,
    ginIndexesToAdd: diff.ginIndexesToAdd.length,
    ginIndexesToDrop: diff.ginIndexesToDrop.length,
    viewBranchCount: diff.viewBranches.length,
  });

  await dropSnapshotsRelIfPresent(sqlClient);
  await createMissingTables(sqlClient, diff.tablesToCreate);
  await dropOrphanedGeneratedColumns(sqlClient, diff.generatedColumnsToDrop);
  await addMissingGeneratedColumns(sqlClient, diff.generatedColumnsToAdd);
  await dropIndexes(sqlClient, diff.singleIndexesToDrop);
  await dropIndexes(sqlClient, diff.compositeIndexesToDrop);
  await dropIndexes(sqlClient, diff.ginIndexesToDrop);
  await createGinIndexes(sqlClient, diff.ginIndexesToAdd);
  await createSingleIndexes(sqlClient, diff.singleIndexesToAdd);
  await createCompositeIndexes(sqlClient, diff.compositeIndexesToAdd);
  await rebuildSnapshotsView(sqlClient, diff.viewBranches);
  warnOnOrphanedTables(log, diff.orphanedTableNames);

  const summary: PgLayoutDiffSummary = {
    tablesCreated: diff.tablesToCreate.length,
    orphanedTablesKept: diff.orphanedTableNames.length,
    generatedColumnsAdded,
    generatedColumnsDropped,
    singleIndexesAdded: diff.singleIndexesToAdd.length,
    singleIndexesDropped: diff.singleIndexesToDrop.length,
    compositeIndexesAdded: diff.compositeIndexesToAdd.length,
    compositeIndexesDropped: diff.compositeIndexesToDrop.length,
    ginIndexesAdded: diff.ginIndexesToAdd.length,
    ginIndexesDropped: diff.ginIndexesToDrop.length,
    viewBranchCount: diff.viewBranches.length,
  };
  log.info('patch-db reconcile: complete', { ...summary });
  return summary;
}
