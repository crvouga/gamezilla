import { assertColumnType, parseTableColumnMap } from './column-spec';
import { fingerprintForIndexDef, indexKey } from './index-fingerprint';
import { assertSnakeCaseIdent } from './snake-case';
import type {
  DeclaredColumn,
  IndexDef,
  RetiredColumn,
  RetiredTable,
} from './types';
import { MANAGED_IMPLICIT_SET } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function parseRetiredColumnEntry(entry: unknown, path: string): RetiredColumn {
  if (!isPlainObject(entry)) {
    throw new Error(`${path}: must be { name, type, note }`);
  }
  const name = entry['name'];
  const note = entry['note'];
  if (typeof name !== 'string') {
    throw new Error(`${path}.name must be a string`);
  }
  if (typeof note !== 'string' || note.length === 0) {
    throw new Error(`${path}: note must be a non-empty string`);
  }
  assertSnakeCaseIdent(name, `${path}.name`);
  if (MANAGED_IMPLICIT_SET.has(name)) {
    throw new Error(`${path}: engine-owned column '${name}' cannot be retired`);
  }
  return {
    name,
    type: assertColumnType(entry['type'], `${path}.type`),
    note,
  };
}

export function parseRetiredColumnsLiteral(
  value: unknown,
  tables: Record<string, Record<string, DeclaredColumn>>
): Map<string, RetiredColumn> {
  const retired = new Map<string, RetiredColumn>();
  if (value === undefined) return retired;
  if (!isPlainObject(value)) {
    throw new Error('retiredColumns: must be an object keyed by table');
  }
  for (const [tableName, entries] of Object.entries(value)) {
    if (!(tableName in tables)) {
      throw new Error(`retiredColumns.${tableName}: unknown table`);
    }
    if (!Array.isArray(entries)) {
      throw new Error(`retiredColumns.${tableName}: must be an array`);
    }
    for (let i = 0; i < entries.length; i++) {
      const path = `retiredColumns.${tableName}[${i}]`;
      const parsed = parseRetiredColumnEntry(entries[i], path);
      if (parsed.name in tables[tableName]!) {
        throw new Error(
          `${path}: column '${parsed.name}' is still declared on table '${tableName}' — remove it from columns and keep only the retiredColumns entry`
        );
      }
      const key = `${tableName}.${parsed.name}`;
      if (retired.has(key)) {
        throw new Error(`${path}: duplicate retired column '${key}'`);
      }
      retired.set(key, parsed);
    }
  }
  return retired;
}

function parseRetiredTableEntry(entry: unknown, path: string): RetiredTable {
  if (!isPlainObject(entry)) {
    throw new Error(`${path}: must be { domain, name, note }`);
  }
  const name = entry['name'];
  const domain = entry['domain'];
  const note = entry['note'];
  if (typeof name !== 'string' || typeof domain !== 'string') {
    throw new Error(`${path}: domain and name must be strings`);
  }
  if (typeof note !== 'string' || note.length === 0) {
    throw new Error(`${path}: note must be a non-empty string`);
  }
  assertSnakeCaseIdent(domain, `${path}.domain`);
  assertSnakeCaseIdent(name, `${path}.name`);
  return { domain, name, note };
}

export function parseRetiredTablesLiteral(
  value: unknown,
  tables: Record<string, Record<string, DeclaredColumn>>
): Map<string, RetiredTable> {
  const retired = new Map<string, RetiredTable>();
  if (value === undefined) return retired;
  if (!Array.isArray(value)) {
    throw new Error('retiredTables: must be an array');
  }
  for (let i = 0; i < value.length; i++) {
    const path = `retiredTables[${i}]`;
    const entry = parseRetiredTableEntry(value[i], path);
    if (entry.name in tables) {
      throw new Error(
        `${path}: table '${entry.name}' is still declared — remove it from tables and keep only the retiredTables entry`
      );
    }
    if (retired.has(entry.name)) {
      throw new Error(`${path}: duplicate retired table '${entry.name}'`);
    }
    retired.set(entry.name, entry);
  }
  return retired;
}

type IndexParseCtx = {
  tables: Record<string, Record<string, DeclaredColumn>>;
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
