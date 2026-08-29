import { parseTableColumnMap } from './column-spec';
import { assertDialectSqlShape } from './dialect-sql';
import { fingerprintForIndexDef, indexKey } from './index-fingerprint';
import { assertSnakeCaseIdent } from './snake-case';
import type {
  CheckDef,
  DeclaredColumn,
  DeclaredEnum,
  DeclaredView,
  DeprecationDef,
  IndexDef,
  ReadonlyDeclaredSchema,
} from './types';
import { MANAGED_IMPLICIT_SET } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDeprecation(entry: unknown, path: string): DeprecationDef {
  if (!Array.isArray(entry)) {
    throw new Error(
      `${path}: deprecation must be [table, note] or [table, column, note]`
    );
  }
  if (entry.length === 2) {
    const [table, note] = entry;
    if (typeof table !== 'string' || typeof note !== 'string' || !note) {
      throw new Error(`${path}: deprecation must be [table, note]`);
    }
    return [table, note];
  }
  if (entry.length === 3) {
    const [table, column, note] = entry;
    if (
      typeof table !== 'string' ||
      typeof column !== 'string' ||
      typeof note !== 'string' ||
      !note
    ) {
      throw new Error(`${path}: deprecation must be [table, column, note]`);
    }
    return [table, column, note];
  }
  throw new Error(
    `${path}: deprecation must be [table, note] or [table, column, note]`
  );
}

export function parseTablesLiteral(
  tablesValue: unknown
): Record<string, Record<string, DeclaredColumn>> {
  if (!isPlainObject(tablesValue)) {
    throw new Error('tables: must be an object');
  }
  const tables: Record<string, Record<string, DeclaredColumn>> = {};
  for (const [tableName, cols] of Object.entries(tablesValue)) {
    assertSnakeCaseIdent(tableName, `tables.${tableName}`);
    tables[tableName] = parseTableColumnMap(tableName, cols);
  }
  return tables;
}

export type DeprecationParseResult = {
  deprecations: DeprecationDef[];
  deprecatedTables: Set<string>;
  deprecatedColumns: Set<string>;
};

export function parseDeprecationsLiteral(
  value: unknown,
  tables: Record<string, Record<string, DeclaredColumn>>
): DeprecationParseResult {
  const deprecations: DeprecationDef[] = [];
  const deprecatedTables = new Set<string>();
  const deprecatedColumns = new Set<string>();
  if (value === undefined) {
    return { deprecations, deprecatedTables, deprecatedColumns };
  }
  if (!Array.isArray(value)) {
    throw new Error('deprecations: must be an array');
  }
  const depSeen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const path = `deprecations[${i}]`;
    const dep = parseDeprecation(value[i], path);
    const [table] = dep;
    if (!(table in tables)) {
      throw new Error(`${path}: unknown table '${table}'`);
    }
    const key = JSON.stringify(dep);
    if (depSeen.has(key)) {
      throw new Error(`${path}: duplicate deprecation entry`);
    }
    depSeen.add(key);
    if (dep.length === 2) {
      deprecatedTables.add(table);
    } else {
      const column = dep[1];
      if (MANAGED_IMPLICIT_SET.has(column)) {
        throw new Error(
          `${path}: cannot deprecate engine-owned column '${column}'`
        );
      }
      assertSnakeCaseIdent(column, `${path}: column`);
      if (column in tables[table]!) {
        throw new Error(
          `${path}: column '${column}' is still declared on table '${table}' — remove it from tables and keep only the deprecation entry`
        );
      }
      deprecatedColumns.add(`${table}.${column}`);
    }
    deprecations.push(dep);
  }
  return { deprecations, deprecatedTables, deprecatedColumns };
}

type IndexParseCtx = {
  tables: Record<string, Record<string, DeclaredColumn>>;
  deprecatedTables: Set<string>;
  deprecatedColumns: Set<string>;
};

function assertIndexColumns(
  path: string,
  table: string,
  columns: string[],
  ctx: IndexParseCtx
): void {
  for (const col of columns) {
    const isManaged = MANAGED_IMPLICIT_SET.has(col);
    if (!isManaged && !(col in ctx.tables[table]!)) {
      throw new Error(`${path}: unknown column '${col}' on table '${table}'`);
    }
    if (ctx.deprecatedColumns.has(`${table}.${col}`)) {
      throw new Error(
        `${path}: column '${table}.${col}' is deprecated and cannot be indexed`
      );
    }
    if (col === 'id') {
      throw new Error(
        `${path}: cannot index primary key 'id' (already unique via PK)`
      );
    }
  }
}

function parseIndexEntry(
  entry: unknown,
  path: string,
  ctx: IndexParseCtx
): IndexDef {
  if (!Array.isArray(entry) || entry.length < 2) {
    throw new Error(`${path}: index must be [table, ...columns]`);
  }
  if (!entry.every((x) => typeof x === 'string')) {
    throw new Error(`${path}: index elements must be strings`);
  }
  const [table, ...columns] = entry as [string, ...string[]];
  if (!(table in ctx.tables)) {
    throw new Error(`${path}: unknown table '${table}'`);
  }
  if (ctx.deprecatedTables.has(table)) {
    throw new Error(
      `${path}: table '${table}' is deprecated and cannot be indexed`
    );
  }
  assertIndexColumns(path, table, columns, ctx);
  const def = [table, ...columns] as IndexDef;
  if (fingerprintForIndexDef(def).length > 63) {
    throw new Error(`${path}: computed index name exceeds 63 bytes`);
  }
  return def;
}

export function parseIndexesLiteral(args: {
  value: unknown;
  ctx: IndexParseCtx;
  field: 'indexes' | 'uniqueIndexes';
  unique: boolean;
  crossSeen: Set<string>;
}): IndexDef[] {
  const { value, ctx, field, unique, crossSeen } = args;
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${field}: must be an array`);
  }
  const indexes: IndexDef[] = [];
  const indexSeen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const path = `${field}[${i}]`;
    const def = parseIndexEntry(value[i], path, ctx);
    const key = indexKey(def, unique);
    if (indexSeen.has(key)) {
      throw new Error(`${path}: duplicate index definition`);
    }
    indexSeen.add(key);
    const columnKey = indexKey(def, false);
    if (crossSeen.has(columnKey)) {
      throw new Error(
        `${path}: columns already indexed (indexes and uniqueIndexes must not overlap)`
      );
    }
    crossSeen.add(columnKey);
    indexes.push(def);
  }
  return indexes;
}

export function parseChecksLiteral(
  value: unknown,
  tables: Record<string, Record<string, DeclaredColumn>>
): CheckDef[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('checks: must be an array');
  }
  const out: CheckDef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const path = `checks[${i}]`;
    const entry = value[i];
    if (!isPlainObject(entry)) {
      throw new Error(`${path}: check must be { name, table, sql }`);
    }
    if (
      typeof entry['name'] !== 'string' ||
      typeof entry['table'] !== 'string'
    ) {
      throw new Error(`${path}: name and table are required`);
    }
    assertSnakeCaseIdent(entry['name'], `${path}.name`);
    assertSnakeCaseIdent(entry['table'], `${path}.table`);
    if (!(entry['table'] in tables)) {
      throw new Error(`${path}: unknown table '${entry['table']}'`);
    }
    const key = `${entry['table']}.${entry['name']}`;
    if (seen.has(key)) {
      throw new Error(`${path}: duplicate check '${key}'`);
    }
    seen.add(key);
    out.push({
      name: entry['name'],
      table: entry['table'],
      sql: assertDialectSqlShape(entry['sql'], `${path}.sql`),
    });
  }
  return out;
}

export function parseViewsLiteral(value: unknown): {
  views: DeclaredView[];
  deprecatedViews: Set<string>;
} {
  const views: DeclaredView[] = [];
  const deprecatedViews = new Set<string>();
  if (value === undefined) return { views, deprecatedViews };
  if (!Array.isArray(value)) {
    throw new Error('views: must be an array');
  }
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const path = `views[${i}]`;
    const entry = value[i];
    if (!isPlainObject(entry)) {
      throw new Error(`${path}: view must be an object`);
    }
    if (
      typeof entry['domain'] !== 'string' ||
      typeof entry['name'] !== 'string'
    ) {
      throw new Error(`${path}: domain and name are required`);
    }
    assertSnakeCaseIdent(entry['name'], `${path}.name`);
    if (seen.has(entry['name'])) {
      throw new Error(`${path}: duplicate view '${entry['name']}'`);
    }
    seen.add(entry['name']);
    views.push({
      domain: entry['domain'],
      name: entry['name'],
      sql: assertDialectSqlShape(entry['sql'], `${path}.sql`),
    });
    if (
      entry['deprecated'] === true ||
      typeof entry['deprecated'] === 'string'
    ) {
      deprecatedViews.add(entry['name']);
    }
  }
  return { views, deprecatedViews };
}

export function parseEnumsLiteral(value: unknown): {
  enums: DeclaredEnum[];
  deprecatedEnums: Set<string>;
} {
  const enums: DeclaredEnum[] = [];
  const deprecatedEnums = new Set<string>();
  if (value === undefined) return { enums, deprecatedEnums };
  if (!Array.isArray(value)) {
    throw new Error('enums: must be an array');
  }
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const path = `enums[${i}]`;
    const entry = value[i];
    if (!isPlainObject(entry)) {
      throw new Error(`${path}: enum must be an object`);
    }
    if (
      typeof entry['domain'] !== 'string' ||
      typeof entry['name'] !== 'string' ||
      !Array.isArray(entry['values'])
    ) {
      throw new Error(`${path}: domain, name, and values are required`);
    }
    assertSnakeCaseIdent(entry['name'], `${path}.name`);
    if (seen.has(entry['name'])) {
      throw new Error(`${path}: duplicate enum '${entry['name']}'`);
    }
    seen.add(entry['name']);
    enums.push({
      domain: entry['domain'],
      name: entry['name'],
      values: entry['values'] as string[],
      ...(entry['nativePostgres'] === true ? { nativePostgres: true } : {}),
    });
    if (
      entry['deprecated'] === true ||
      typeof entry['deprecated'] === 'string'
    ) {
      deprecatedEnums.add(entry['name']);
    }
  }
  return { enums, deprecatedEnums };
}

export function emptyPortableExtras(): Pick<
  ReadonlyDeclaredSchema,
  'checks' | 'views' | 'enums' | 'deprecatedViews' | 'deprecatedEnums'
> {
  return {
    checks: [],
    views: [],
    enums: [],
    deprecatedViews: new Set(),
    deprecatedEnums: new Set(),
  };
}
