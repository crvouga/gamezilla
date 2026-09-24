import type { ColumnType, ReadonlyDeclaredSchema, Snapshot } from './types';

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = obj[key]!;
  }
  return out;
}

function sortTables(
  tables: ReadonlyDeclaredSchema['tables']
): Snapshot['tables'] {
  const sorted: Record<string, Record<string, ColumnType>> = {};
  for (const table of Object.keys(tables).sort()) {
    const cols: Record<string, ColumnType> = {};
    for (const name of Object.keys(tables[table]!).sort()) {
      cols[name] = tables[table]![name]!.type;
    }
    sorted[table] = cols;
  }
  return sorted;
}

function sortPhysicalOverrides(
  tables: ReadonlyDeclaredSchema['tables']
): Snapshot['physicalOverrides'] {
  const out: Record<
    string,
    Record<string, { postgres?: string; sqlite?: string }>
  > = {};
  for (const table of Object.keys(tables).sort()) {
    const cols: Record<string, { postgres?: string; sqlite?: string }> = {};
    for (const name of Object.keys(tables[table]!).sort()) {
      const col = tables[table]![name]!;
      if (
        col.physicalPostgres === undefined &&
        col.physicalSqlite === undefined
      ) {
        continue;
      }
      cols[name] = {
        ...(col.physicalPostgres !== undefined
          ? { postgres: col.physicalPostgres }
          : {}),
        ...(col.physicalSqlite !== undefined
          ? { sqlite: col.physicalSqlite }
          : {}),
      };
    }
    if (Object.keys(cols).length > 0) out[table] = cols;
  }
  return out;
}

function tupleJson(t: readonly unknown[]): string {
  return JSON.stringify(t);
}

function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortRetiredColumns(
  retired: ReadonlyDeclaredSchema['retiredColumns']
): Snapshot['retiredColumns'] {
  const sorted: Record<
    string,
    Record<string, { readonly type: ColumnType; readonly note: string }>
  > = {};
  for (const key of [...retired.keys()].sort(compareCodeUnit)) {
    const entry = retired.get(key)!;
    const table = key.slice(0, key.lastIndexOf('.'));
    const byColumn = sorted[table] ?? {};
    byColumn[entry.name] = { type: entry.type, note: entry.note };
    sorted[table] = byColumn;
  }
  for (const table of Object.keys(sorted)) {
    sorted[table] = sortKeys(sorted[table]!);
  }
  return sorted;
}

function sortRetiredTables(
  retired: ReadonlyDeclaredSchema['retiredTables']
): Snapshot['retiredTables'] {
  return [...retired.values()]
    .sort((a, b) => compareCodeUnit(a.name, b.name))
    .map((entry) => ({ name: entry.name, note: entry.note }));
}

export function buildSnapshot(declared: ReadonlyDeclaredSchema): Snapshot {
  const indexes = [...declared.indexes].sort((a, b) =>
    compareCodeUnit(tupleJson(a), tupleJson(b))
  );
  const uniqueIndexes = [...declared.uniqueIndexes].sort((a, b) =>
    compareCodeUnit(tupleJson(a), tupleJson(b))
  );
  return {
    tables: sortTables(declared.tables),
    physicalOverrides: sortPhysicalOverrides(declared.tables),
    retiredColumns: sortRetiredColumns(declared.retiredColumns),
    retiredTables: sortRetiredTables(declared.retiredTables),
    indexes,
    uniqueIndexes,
  };
}
