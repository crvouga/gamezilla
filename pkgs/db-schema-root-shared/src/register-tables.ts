import { sealSchema, validateRuntime } from './define-schema';
import type { TableDef } from './define-table';
import type {
  DeclaredColumn,
  IndexDef,
  RetiredColumn,
  RetiredTable,
  Schema,
} from './types';

type MergedTableDefs = {
  tables: Record<string, Record<string, DeclaredColumn>>;
  indexes: readonly IndexDef[];
  uniqueIndexes: readonly IndexDef[];
  retiredColumns: Record<string, readonly RetiredColumn[]>;
};

function mergeTableDefs(tables: readonly TableDef[]): MergedTableDefs {
  const tableMap: Record<string, Record<string, DeclaredColumn>> = {};
  const indexes: IndexDef[] = [];
  const uniqueIndexes: IndexDef[] = [];
  const retiredColumns: Record<string, readonly RetiredColumn[]> = {};

  for (const table of tables) {
    const { name, _slice } = table;
    if (name in tableMap) {
      throw new Error(`registerTables: duplicate table '${name}'`);
    }
    tableMap[name] = { ..._slice.columns };
    indexes.push(..._slice.indexes);
    uniqueIndexes.push(..._slice.uniqueIndexes);
    if (_slice.retiredColumns.length > 0) {
      retiredColumns[name] = _slice.retiredColumns;
    }
  }

  return { tables: tableMap, indexes, uniqueIndexes, retiredColumns };
}

/** Sorted unique domain ids used when composing a schema. */
export function domainsFromTables(
  tables: readonly TableDef[],
  retiredTables: readonly RetiredTable[] = []
): readonly string[] {
  const domains = new Set<string>();
  for (const table of tables) {
    domains.add(table.domain);
  }
  for (const table of retiredTables) {
    domains.add(table.domain);
  }
  return [...domains].sort();
}

export type RegisterTablesOptions = {
  /** Tables removed from the schema that the server must keep present. */
  readonly retiredTables?: readonly RetiredTable[];
};

/**
 * Compose registered {@link defineTable} results into an immutable {@link Schema}.
 */
export function registerTables(
  tables: readonly TableDef[],
  options?: RegisterTablesOptions
): Schema {
  const merged = mergeTableDefs(tables);
  const retiredTables = options?.retiredTables ?? [];
  const declared = validateRuntime(
    { ...merged, retiredTables },
    {
      tableNamePolicy: {
        domains: domainsFromTables(tables, retiredTables),
      },
    }
  );
  return sealSchema(declared);
}
