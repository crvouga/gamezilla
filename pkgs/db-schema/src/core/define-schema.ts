import { fingerprintForIndexDef, indexKey } from './index-fingerprint';
import { assertSnakeCaseIdent } from './snake-case';
import { buildSnapshot } from './snapshot';
import type {
  ColumnType,
  DeprecationDef,
  IndexDef,
  ReadonlyDeclaredSchema,
  Schema,
  Snapshot,
} from './types';
import { COLUMN_TYPE_SET } from './types';
import type {
  SchemaInput,
  SchemaLiteral,
  ValidateSchema,
} from './validate-schema-types';

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Reflect.ownKeys(value)) {
    const child = (value as Record<PropertyKey, unknown>)[key];
    if (child !== null && typeof child === 'object') {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDeprecationPair(
  table: unknown,
  note: unknown,
  path: string
): DeprecationDef {
  if (typeof table !== 'string' || typeof note !== 'string') {
    throw new Error(
      `${path}: deprecation must be [table, note] with string elements`
    );
  }
  if (note.length === 0) {
    throw new Error(`${path}: note is required`);
  }
  return [table, note];
}

function parseDeprecationTriple(
  table: unknown,
  column: unknown,
  note: unknown,
  path: string
): DeprecationDef {
  if (
    typeof table !== 'string' ||
    typeof column !== 'string' ||
    typeof note !== 'string'
  ) {
    throw new Error(
      `${path}: deprecation must be [table, column, note] with string elements`
    );
  }
  if (note.length === 0) {
    throw new Error(`${path}: note is required`);
  }
  return [table, column, note];
}

function parseDeprecation(entry: unknown, path: string): DeprecationDef {
  if (!Array.isArray(entry)) {
    throw new Error(
      `${path}: deprecation must be [table, note] or [table, column, note]`
    );
  }
  if (entry.length === 2) {
    return parseDeprecationPair(entry[0], entry[1], path);
  }
  if (entry.length === 3) {
    return parseDeprecationTriple(entry[0], entry[1], entry[2], path);
  }
  throw new Error(
    `${path}: deprecation must be [table, note] or [table, column, note]`
  );
}

function assertKnownTopLevelKeys(literal: Record<string, unknown>): void {
  const allowed = new Set([
    'tables',
    'indexes',
    'uniqueIndexes',
    'deprecations',
  ]);
  for (const key of Object.keys(literal)) {
    if (!allowed.has(key)) {
      throw new Error(`unknown top-level key '${key}'`);
    }
  }
}

function parseTableColumns(
  tableName: string,
  cols: unknown
): Record<string, ColumnType> {
  if (!isPlainObject(cols)) {
    throw new Error(`tables.${tableName}: columns must be an object`);
  }
  const tableCols: Record<string, ColumnType> = {};
  for (const [colName, token] of Object.entries(cols)) {
    const path = `tables.${tableName}.${colName}`;
    assertSnakeCaseIdent(colName, path);
    if (typeof token !== 'string' || !COLUMN_TYPE_SET.has(token)) {
      throw new Error(
        `${path}: column type must be one of uuid|text|integer|boolean|timestamp|json`
      );
    }
    tableCols[colName] = token as ColumnType;
  }
  return tableCols;
}

function parseTables(
  tablesValue: unknown
): Record<string, Record<string, ColumnType>> {
  if (!isPlainObject(tablesValue)) {
    throw new Error('tables: must be an object');
  }
  const tables: Record<string, Record<string, ColumnType>> = {};
  for (const [tableName, cols] of Object.entries(tablesValue)) {
    assertSnakeCaseIdent(tableName, `tables.${tableName}`);
    tables[tableName] = parseTableColumns(tableName, cols);
  }
  return tables;
}

type DeprecationParseResult = {
  deprecations: DeprecationDef[];
  deprecatedTables: Set<string>;
  deprecatedColumns: Set<string>;
};

function registerColumnDeprecation(args: {
  path: string;
  table: string;
  column: string;
  tables: Record<string, Record<string, ColumnType>>;
  deprecatedColumns: Set<string>;
}): void {
  const { path, table, column, tables, deprecatedColumns } = args;
  if (column.startsWith('_')) {
    throw new Error(
      `${path}: cannot deprecate engine-owned column '${column}'`
    );
  }
  if (!(column in tables[table]!)) {
    throw new Error(`${path}: unknown column '${column}' on table '${table}'`);
  }
  deprecatedColumns.add(`${table}.${column}`);
}

function parseDeprecations(
  value: unknown,
  tables: Record<string, Record<string, ColumnType>>
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
      registerColumnDeprecation({
        path,
        table,
        column: dep[1],
        tables,
        deprecatedColumns,
      });
    }
    deprecations.push(dep);
  }
  return { deprecations, deprecatedTables, deprecatedColumns };
}

type IndexParseCtx = {
  tables: Record<string, Record<string, ColumnType>>;
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
    if (!(col in ctx.tables[table]!)) {
      throw new Error(`${path}: unknown column '${col}' on table '${table}'`);
    }
    if (ctx.deprecatedColumns.has(`${table}.${col}`)) {
      throw new Error(
        `${path}: column '${table}.${col}' is deprecated and cannot be indexed`
      );
    }
    if (col.startsWith('_')) {
      throw new Error(`${path}: cannot index engine-owned column '${col}'`);
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

function parseIndexes(args: {
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

function validateRuntime(literal: unknown): ReadonlyDeclaredSchema {
  if (!isPlainObject(literal)) {
    throw new Error('schema: must be an object');
  }
  assertKnownTopLevelKeys(literal);
  const tables = parseTables(literal['tables']);
  const { deprecations, deprecatedTables, deprecatedColumns } =
    parseDeprecations(literal['deprecations'], tables);
  const indexCtx: IndexParseCtx = {
    tables,
    deprecatedTables,
    deprecatedColumns,
  };
  const crossSeen = new Set<string>();
  const indexes = parseIndexes({
    value: literal['indexes'],
    ctx: indexCtx,
    field: 'indexes',
    unique: false,
    crossSeen,
  });
  const uniqueIndexes = parseIndexes({
    value: literal['uniqueIndexes'],
    ctx: indexCtx,
    field: 'uniqueIndexes',
    unique: true,
    crossSeen,
  });
  return {
    tables,
    indexes,
    uniqueIndexes,
    deprecations,
    deprecatedTables,
    deprecatedColumns,
  };
}

/**
 * Validate, deep-freeze, and seal a declarative schema literal.
 * When this returns, the schema is complete and permanently immutable.
 */
export function defineSchema<const T>(literal: SchemaInput<T>): Schema {
  const declared = validateRuntime(literal);
  const frozenDeclared = deepFreeze(declared);

  const schema: Schema = {
    snapshot(): Snapshot {
      return buildSnapshot(frozenDeclared);
    },
    _declared: frozenDeclared,
  };

  return deepFreeze(schema);
}

export type { SchemaInput, SchemaLiteral, ValidateSchema };
