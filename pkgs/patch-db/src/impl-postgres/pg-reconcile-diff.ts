/**
 * Pure diff helpers used by {@link ./pg-reconcile.diffPgLayout}. Lives in
 * its own file so the orchestrator can focus on the apply-order policy
 * without owning per-bucket diff arithmetic too — and to keep both files
 * under the Tiger-style size cap.
 *
 * Every helper here is pure, independent of any DB connection, and
 * unit-tested through `pg-reconcile.test.ts`.
 */
import type {
  DesiredCompositeIndex,
  DesiredEntityTable,
  DesiredPgLayout,
  DesiredSingleIndex,
} from './pg-layout';
import type { LivePgLayout } from './pg-introspect';
import type { GeneratedColumnSpec } from './partitioning';

export type CompositeIndexOnTable = {
  readonly tableName: string;
  readonly spec: DesiredCompositeIndex;
};

export type SingleIndexOnTable = {
  readonly tableName: string;
  readonly spec: DesiredSingleIndex;
};

export type GinIndexOnTable = {
  readonly tableName: string;
  readonly indexName: string;
};

export type IndexRefOnTable = {
  readonly tableName: string;
  readonly indexName: string;
};

/** Per-table batch of generated columns to add / drop on one `ALTER TABLE`. */
export type GeneratedColumnsOnTable = {
  readonly tableName: string;
  readonly specs: readonly GeneratedColumnSpec[];
};

export type GeneratedColumnDropsOnTable = {
  readonly tableName: string;
  readonly columnNames: readonly string[];
};

export function diffTables(
  desired: DesiredPgLayout,
  live: LivePgLayout
): {
  toCreate: readonly DesiredEntityTable[];
  orphaned: readonly string[];
} {
  const liveTables = new Set(live.tableNames);
  const toCreate: DesiredEntityTable[] = [];
  for (const table of desired.tables.values()) {
    if (!liveTables.has(table.tableName)) {
      toCreate.push(table);
    }
  }
  const orphaned: string[] = [];
  for (const liveName of live.tableNames) {
    if (!desired.tables.has(liveName)) {
      orphaned.push(liveName);
    }
  }
  return { toCreate, orphaned };
}

function diffGeneratedColumnsForTable(
  table: DesiredEntityTable,
  liveColumns: ReadonlySet<string>
): {
  toAdd: readonly GeneratedColumnSpec[];
  toDrop: readonly string[];
} {
  const toAdd: GeneratedColumnSpec[] = [];
  for (const [name, spec] of table.generatedColumns) {
    if (!liveColumns.has(name)) toAdd.push(spec);
  }
  const toDrop: string[] = [];
  for (const name of liveColumns) {
    if (!table.generatedColumns.has(name)) toDrop.push(name);
  }
  return { toAdd, toDrop };
}

export function diffGeneratedColumns(
  desired: DesiredPgLayout,
  live: LivePgLayout
): {
  toAdd: readonly GeneratedColumnsOnTable[];
  toDrop: readonly GeneratedColumnDropsOnTable[];
} {
  const toAddBatches: GeneratedColumnsOnTable[] = [];
  const toDropBatches: GeneratedColumnDropsOnTable[] = [];
  // Desired tables: add what's missing; drop what the live table has but
  // the registry no longer claims.
  for (const table of desired.tables.values()) {
    const liveCols =
      live.generatedColumnsByTable.get(table.tableName) ?? new Set<string>();
    const { toAdd, toDrop } = diffGeneratedColumnsForTable(table, liveCols);
    if (toAdd.length > 0) {
      toAddBatches.push({ tableName: table.tableName, specs: toAdd });
    }
    if (toDrop.length > 0) {
      toDropBatches.push({ tableName: table.tableName, columnNames: toDrop });
    }
  }
  // Live tables not in the desired set: drop every gen col on them so the
  // orphaned table is at least clean if a DBA wants to keep it. (The table
  // itself is preserved per the additive-only policy.)
  for (const [tableName, liveCols] of live.generatedColumnsByTable) {
    if (desired.tables.has(tableName)) continue;
    if (liveCols.size === 0) continue;
    toDropBatches.push({
      tableName,
      columnNames: [...liveCols],
    });
  }
  return { toAdd: toAddBatches, toDrop: toDropBatches };
}

type LiveIndexByTable = ReadonlyMap<string, ReadonlySet<string>>;

function indexLookup(
  rows: readonly { tableName: string; indexName: string }[]
): LiveIndexByTable {
  const byTable = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byTable.get(r.tableName) ?? new Set<string>();
    set.add(r.indexName);
    byTable.set(r.tableName, set);
  }
  return byTable;
}

export function diffSingleIndexes(
  desired: DesiredPgLayout,
  live: LivePgLayout
): {
  toAdd: readonly SingleIndexOnTable[];
  toDrop: readonly IndexRefOnTable[];
} {
  const liveByTable = indexLookup(live.singleIndexes);
  const desiredByTable = new Map<
    string,
    ReadonlyMap<string, DesiredSingleIndex>
  >();
  for (const table of desired.tables.values()) {
    desiredByTable.set(table.tableName, table.singleIndexes);
  }
  const toAdd: SingleIndexOnTable[] = [];
  for (const table of desired.tables.values()) {
    const liveNames =
      liveByTable.get(table.tableName) ?? new Set<string>();
    for (const spec of table.singleIndexes.values()) {
      if (!liveNames.has(spec.indexName)) {
        toAdd.push({ tableName: table.tableName, spec });
      }
    }
  }
  const toDrop: IndexRefOnTable[] = [];
  for (const [tableName, liveNames] of liveByTable) {
    const desiredNames =
      desiredByTable.get(tableName) ?? new Map<string, DesiredSingleIndex>();
    for (const indexName of liveNames) {
      if (!desiredNames.has(indexName)) {
        toDrop.push({ tableName, indexName });
      }
    }
  }
  return { toAdd, toDrop };
}

export function diffCompositeIndexes(
  desired: DesiredPgLayout,
  live: LivePgLayout
): {
  toAdd: readonly CompositeIndexOnTable[];
  toDrop: readonly IndexRefOnTable[];
} {
  const liveByTable = indexLookup(live.compositeIndexes);
  const desiredByTable = new Map<
    string,
    ReadonlyMap<string, DesiredCompositeIndex>
  >();
  for (const table of desired.tables.values()) {
    desiredByTable.set(table.tableName, table.compositeIndexes);
  }
  const toAdd: CompositeIndexOnTable[] = [];
  for (const table of desired.tables.values()) {
    const liveNames =
      liveByTable.get(table.tableName) ?? new Set<string>();
    for (const spec of table.compositeIndexes.values()) {
      if (!liveNames.has(spec.indexName)) {
        toAdd.push({ tableName: table.tableName, spec });
      }
    }
  }
  const toDrop: IndexRefOnTable[] = [];
  for (const [tableName, liveNames] of liveByTable) {
    const desiredNames =
      desiredByTable.get(tableName) ??
      new Map<string, DesiredCompositeIndex>();
    for (const indexName of liveNames) {
      if (!desiredNames.has(indexName)) {
        toDrop.push({ tableName, indexName });
      }
    }
  }
  return { toAdd, toDrop };
}

export function diffGinIndexes(
  desired: DesiredPgLayout,
  live: LivePgLayout
): {
  toAdd: readonly GinIndexOnTable[];
  toDrop: readonly IndexRefOnTable[];
} {
  const liveByTable = indexLookup(live.ginIndexes);
  const desiredGinByTable = new Map<string, string>();
  for (const table of desired.tables.values()) {
    desiredGinByTable.set(table.tableName, table.ginIndexName);
  }
  const toAdd: GinIndexOnTable[] = [];
  for (const table of desired.tables.values()) {
    const liveNames =
      liveByTable.get(table.tableName) ?? new Set<string>();
    if (!liveNames.has(table.ginIndexName)) {
      toAdd.push({
        tableName: table.tableName,
        indexName: table.ginIndexName,
      });
    }
  }
  const toDrop: IndexRefOnTable[] = [];
  for (const [tableName, liveNames] of liveByTable) {
    const desiredName = desiredGinByTable.get(tableName);
    for (const indexName of liveNames) {
      if (desiredName === undefined || indexName !== desiredName) {
        toDrop.push({ tableName, indexName });
      }
    }
  }
  return { toAdd, toDrop };
}

export function viewBranchesOf(
  desired: DesiredPgLayout
): readonly DesiredEntityTable[] {
  // Sort by table name so the emitted view text is stable across runs;
  // the test harness asserts on the SQL string, and Postgres doesn't care
  // about UNION-branch order for constraint exclusion.
  return [...desired.tables.values()].sort((a, b) =>
    a.tableName.localeCompare(b.tableName)
  );
}
