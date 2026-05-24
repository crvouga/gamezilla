/**
 * Read-only Postgres catalog introspection scoped to the namespaces the
 * reconciler owns (see {@link ./pg-layout} for the ownership rules).
 *
 * Anything outside the patch-db namespaces is invisible to this module by
 * construction — the catalog queries filter at the source so a DBA-managed
 * index named `idx_foo` on `snapshots__chess_puzzle` never even appears
 * in the result.
 *
 * Per-entity standalone tables (`snapshots__<slug>` with `relkind = 'r'`)
 * carry their own typed generated columns; the introspection bucket maps
 * each live table to the set of `gc_*` columns it actually declares, so
 * the reconciler can drop stray columns table-locally instead of pretending
 * generated columns are global on a partitioned parent.
 */
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  PATCH_DB_COMPOSITE_INDEX_PREFIX,
  PATCH_DB_GENERATED_COLUMN_PREFIX,
  PATCH_DB_GIN_INDEX_PREFIX,
  PATCH_DB_PARTITION_PREFIX,
  PATCH_DB_SINGLE_INDEX_SUFFIX,
} from './partitioning';

/** What kind of object `snapshots` currently is in the catalog. Used by the
 *  migrate entry point to detect (and DROP CASCADE) a legacy partitioned
 *  parent left over from before the architectural pivot to standalone
 *  per-entity tables. */
export type SnapshotsRelKind =
  /** No `snapshots` exists yet — brand new DB. */
  | 'absent'
  /** Legacy declarative-partitioning parent. Must be dropped before the
   *  new per-entity tables can be created. */
  | 'partitioned'
  /** The current architecture: `snapshots` is the `UNION ALL` view that
   *  the reconciler rebuilds on every migrate. */
  | 'view'
  /** Something else (a plain table, materialised view, foreign table…) —
   *  unexpected. Caller decides how to handle. */
  | 'other';

/** Live layout — the same shape as {@link DesiredPgLayout} but flattened to
 *  the names the catalog actually returns. The diff stage promotes these
 *  into per-table maps. */
export type LivePgLayout = {
  /** `snapshots__<slug>` standalone tables (`pg_class.relkind = 'r'`)
   *  the reconciler owns. Excludes legacy `snapshots__default` left over
   *  from the previous partitioned design. */
  readonly tableNames: readonly string[];
  /** Generated columns (`gc_*`) declared on each per-entity table,
   *  keyed by table name → set of column names. */
  readonly generatedColumnsByTable: ReadonlyMap<string, ReadonlySet<string>>;
  /** Per-entity single-column btrees (`gc_*_idx`) keyed by their table. */
  readonly singleIndexes: readonly {
    readonly tableName: string;
    readonly indexName: string;
  }[];
  /** Per-entity composite btrees (`pdb_cidx_*`) keyed by their table. */
  readonly compositeIndexes: readonly {
    readonly tableName: string;
    readonly indexName: string;
  }[];
  /** Per-entity GIN indexes (`pdb_gin_*`) keyed by their table. */
  readonly ginIndexes: readonly {
    readonly tableName: string;
    readonly indexName: string;
  }[];
};

/** Query for standalone (non-partitioned) per-entity tables. `relkind = 'r'`
 *  is a plain table; we exclude `relkind = 'p'` (partitioned parent) and
 *  the legacy `snapshots__default` child partition. The schema filter
 *  scopes us to the current search_path so two DBs sharing a cluster
 *  don't bleed into each other. */
const SELECT_TABLES = `
  SELECT c.relname AS table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relname LIKE '${PATCH_DB_PARTITION_PREFIX}%'
    AND c.relname <> '${PATCH_DB_PARTITION_PREFIX}default'
    AND c.relkind = 'r'
`;

/** Per-entity generated columns. Filtered to the patch-db `gc_` namespace
 *  so DBA-added columns on the same table are invisible. */
const SELECT_GENERATED_COLUMNS = `
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name LIKE '${PATCH_DB_PARTITION_PREFIX}%'
    AND table_name <> '${PATCH_DB_PARTITION_PREFIX}default'
    AND column_name LIKE '${PATCH_DB_GENERATED_COLUMN_PREFIX}%'
`;

const SELECT_INDEXES = `
  SELECT tablename AS table_name, indexname
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename LIKE '${PATCH_DB_PARTITION_PREFIX}%'
    AND tablename <> '${PATCH_DB_PARTITION_PREFIX}default'
    AND (
      indexname LIKE '${PATCH_DB_GENERATED_COLUMN_PREFIX}%${PATCH_DB_SINGLE_INDEX_SUFFIX}'
      OR indexname LIKE '${PATCH_DB_COMPOSITE_INDEX_PREFIX}%'
      OR indexname LIKE '${PATCH_DB_GIN_INDEX_PREFIX}%'
    )
`;

/** Probe for `pg_class.relkind` of the `snapshots` object. */
const SELECT_SNAPSHOTS_RELKIND = `
  SELECT c.relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = current_schema()
    AND c.relname = 'snapshots'
`;

function isSingleColumnIndexName(indexName: string): boolean {
  return (
    indexName.startsWith(PATCH_DB_GENERATED_COLUMN_PREFIX) &&
    indexName.endsWith(PATCH_DB_SINGLE_INDEX_SUFFIX)
  );
}

function isCompositeIndexName(indexName: string): boolean {
  return indexName.startsWith(PATCH_DB_COMPOSITE_INDEX_PREFIX);
}

function isGinIndexName(indexName: string): boolean {
  return indexName.startsWith(PATCH_DB_GIN_INDEX_PREFIX);
}

function classifyRelKind(raw: string | null): SnapshotsRelKind {
  if (raw === null) return 'absent';
  if (raw === 'p') return 'partitioned';
  if (raw === 'v') return 'view';
  return 'other';
}

/**
 * Looks up the `pg_class.relkind` of `snapshots` so the migrate entry
 * point can decide whether to nuke a legacy partitioned parent (chars: see
 * {@link SnapshotsRelKind}).
 *
 * Returns `'absent'` for a brand-new database where no `snapshots` object
 * exists yet.
 */
export async function probeSnapshotsRelKind(
  sqlClient: SqlClient
): Promise<SnapshotsRelKind> {
  const rows = await sqlClient.query<{ relkind: string }>(
    SELECT_SNAPSHOTS_RELKIND
  );
  const raw = rows[0]?.relkind ?? null;
  return classifyRelKind(raw);
}

function groupGeneratedColumnsByTable(
  rows: readonly { table_name: string; column_name: string }[]
): ReadonlyMap<string, ReadonlySet<string>> {
  const byTable = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byTable.get(r.table_name) ?? new Set<string>();
    set.add(r.column_name);
    byTable.set(r.table_name, set);
  }
  return byTable;
}

export async function introspectPgLayout(
  sqlClient: SqlClient
): Promise<LivePgLayout> {
  const tableRows = await sqlClient.query<{ table_name: string }>(
    SELECT_TABLES
  );
  const columnRows = await sqlClient.query<{
    table_name: string;
    column_name: string;
  }>(SELECT_GENERATED_COLUMNS);
  const indexRows = await sqlClient.query<{
    table_name: string;
    indexname: string;
  }>(SELECT_INDEXES);

  const singleIndexes: { tableName: string; indexName: string }[] = [];
  const compositeIndexes: { tableName: string; indexName: string }[] = [];
  const ginIndexes: { tableName: string; indexName: string }[] = [];
  for (const row of indexRows) {
    if (isCompositeIndexName(row.indexname)) {
      compositeIndexes.push({
        tableName: row.table_name,
        indexName: row.indexname,
      });
      continue;
    }
    if (isGinIndexName(row.indexname)) {
      ginIndexes.push({
        tableName: row.table_name,
        indexName: row.indexname,
      });
      continue;
    }
    if (isSingleColumnIndexName(row.indexname)) {
      singleIndexes.push({
        tableName: row.table_name,
        indexName: row.indexname,
      });
    }
  }

  return Object.freeze({
    tableNames: tableRows.map((r) => r.table_name),
    generatedColumnsByTable: groupGeneratedColumnsByTable(columnRows),
    singleIndexes,
    compositeIndexes,
    ginIndexes,
  });
}
