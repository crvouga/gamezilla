import type { ColumnType, ReadonlyDeclaredSchema, Snapshot } from './types';

function sortKeys<T>(obj: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = obj[key]!;
  }
  return out;
}

function sortNestedTables(
  tables: ReadonlyDeclaredSchema['tables']
): Snapshot['tables'] {
  const sorted: Record<string, Record<string, ColumnType>> = {};
  for (const table of Object.keys(tables).sort()) {
    sorted[table] = sortKeys({ ...tables[table]! });
  }
  return sorted;
}

function tupleJson(t: readonly unknown[]): string {
  return JSON.stringify(t);
}

export function buildSnapshot(declared: ReadonlyDeclaredSchema): Snapshot {
  const indexes = [...declared.indexes].sort((a, b) =>
    tupleJson(a).localeCompare(tupleJson(b))
  );
  const uniqueIndexes = [...declared.uniqueIndexes].sort((a, b) =>
    tupleJson(a).localeCompare(tupleJson(b))
  );
  const deprecations = [...declared.deprecations].sort((a, b) =>
    tupleJson(a).localeCompare(tupleJson(b))
  );
  return {
    tables: sortNestedTables(declared.tables),
    indexes,
    uniqueIndexes,
    deprecations,
  };
}
