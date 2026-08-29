import type {
  ColumnType,
  DeclaredColumn,
  ReadonlyDeclaredSchema,
  Snapshot,
} from './types';

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
    const cols: Record<string, ColumnType> = {};
    for (const [name, col] of Object.entries(tables[table]!)) {
      cols[name] = (col as DeclaredColumn).type;
    }
    sorted[table] = sortKeys(cols);
  }
  return sorted;
}

function tupleJson(t: readonly unknown[]): string {
  return JSON.stringify(t);
}

function compareCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function buildSnapshot(declared: ReadonlyDeclaredSchema): Snapshot {
  const indexes = [...declared.indexes].sort((a, b) =>
    compareCodeUnit(tupleJson(a), tupleJson(b))
  );
  const uniqueIndexes = [...declared.uniqueIndexes].sort((a, b) =>
    compareCodeUnit(tupleJson(a), tupleJson(b))
  );
  const deprecations = [...declared.deprecations].sort((a, b) =>
    compareCodeUnit(tupleJson(a), tupleJson(b))
  );
  const checks = [...declared.checks].sort((a, b) =>
    compareCodeUnit(`${a.table}.${a.name}`, `${b.table}.${b.name}`)
  );
  const views = [...declared.views].sort((a, b) =>
    compareCodeUnit(a.name, b.name)
  );
  const enums = [...declared.enums].sort((a, b) =>
    compareCodeUnit(a.name, b.name)
  );
  return {
    tables: sortNestedTables(declared.tables),
    indexes,
    uniqueIndexes,
    deprecations,
    checks,
    views,
    enums,
  };
}
