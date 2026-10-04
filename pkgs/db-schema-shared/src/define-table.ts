import type { ColumnSpecInput } from './column-spec';
import {
  assertColumnType,
  parseTableColumnMap,
  validateColumnLifecycle,
} from './column-spec';
import { assertSnakeCaseIdent } from './snake-case';
import type { DeclaredColumn, IndexDef, RetiredColumn } from './types';
import { MANAGED_IMPLICIT_SET } from './types';

function assertMatchesDomain(
  tableName: string,
  domain: string,
  path: string
): void {
  assertSnakeCaseIdent(domain, `${path}.domain`);
  if (tableName !== domain && !tableName.startsWith(`${domain}_`)) {
    throw new Error(
      `${path}: name '${tableName}' must equal domain '${domain}' or start with '${domain}_'`
    );
  }
}

function normalizeIndexEntries(
  tableName: string,
  field: 'indexes' | 'uniqueIndexes',
  entries: readonly (string | readonly string[])[] | undefined
): IndexDef[] {
  if (entries === undefined) return [];
  const out: IndexDef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const cols = typeof entry === 'string' ? [entry] : [...entry];
    if (cols.length === 0) {
      throw new Error(`defineTable(${tableName}).${field}[${i}]: empty index`);
    }
    for (const col of cols) {
      assertSnakeCaseIdent(col, `defineTable(${tableName}).${field}[${i}]`);
    }
    const key = cols.join('\0');
    if (seen.has(key)) {
      throw new Error(
        `defineTable(${tableName}).${field}[${i}]: duplicate index definition`
      );
    }
    seen.add(key);
    out.push([tableName, ...cols]);
  }
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRetiredColumns(
  tableName: string,
  entries: readonly RetiredColumn[] | undefined
): RetiredColumn[] {
  if (entries === undefined) return [];
  const out: RetiredColumn[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < entries.length; i++) {
    const path = `defineTable(${tableName}).retiredColumns[${i}]`;
    const entry: unknown = entries[i];
    if (!isPlainObject(entry)) {
      throw new Error(`${path}: must be { name, type, note }`);
    }
    const name = entry['name'];
    if (typeof name !== 'string') {
      throw new Error(`${path}.name must be a string`);
    }
    assertSnakeCaseIdent(name, `${path}.name`);
    if (MANAGED_IMPLICIT_SET.has(name)) {
      throw new Error(
        `${path}: engine-owned column '${name}' cannot be retired`
      );
    }
    if (seen.has(name)) {
      throw new Error(`${path}: duplicate retired column '${name}'`);
    }
    seen.add(name);
    const note = entry['note'];
    if (typeof note !== 'string' || note.length === 0) {
      throw new Error(`${path}: note must be a non-empty string`);
    }
    out.push({
      name,
      type: assertColumnType(entry['type'], `${path}.type`),
      note,
    });
  }
  return out;
}

export type TableDefInput = {
  readonly domain: string;
  readonly name: string;
  readonly columns: Record<string, ColumnSpecInput>;
  readonly indexes?: readonly (string | readonly string[])[];
  readonly uniqueIndexes?: readonly (string | readonly string[])[];
  readonly retiredColumns?: readonly RetiredColumn[];
};

export type TableDefSlice = {
  readonly domain: string;
  readonly name: string;
  readonly columns: Record<string, DeclaredColumn>;
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  readonly retiredColumns: readonly RetiredColumn[];
};

export type TableDef<Name extends string = string> = {
  readonly domain: string;
  readonly name: Name;
  readonly _slice: TableDefSlice;
  readonly kind: 'table';
};

/**
 * Declare a single domain table with optional per-table indexes and
 * `retiredColumns` tombstones.
 */
export function defineTable<const T extends TableDefInput>(
  input: T
): TableDef<T['name']> {
  const path = `defineTable(${input.name})`;
  assertSnakeCaseIdent(input.name, `${path}.name`);
  assertMatchesDomain(input.name, input.domain, path);
  const columns = parseTableColumnMap(input.name, input.columns);
  const indexes = normalizeIndexEntries(input.name, 'indexes', input.indexes);
  const uniqueIndexes = normalizeIndexEntries(
    input.name,
    'uniqueIndexes',
    input.uniqueIndexes
  );
  const retiredColumns = normalizeRetiredColumns(
    input.name,
    input.retiredColumns
  );
  for (const retired of retiredColumns) {
    if (retired.name in columns) {
      throw new Error(
        `${path}.retiredColumns: '${retired.name}' is still declared — remove it from columns`
      );
    }
  }
  validateColumnLifecycle({
    tableName: input.name,
    columns,
    retiredCols: new Set(retiredColumns.map((r) => r.name)),
  });
  return Object.freeze({
    kind: 'table' as const,
    domain: input.domain,
    name: input.name,
    _slice: Object.freeze({
      domain: input.domain,
      name: input.name,
      columns,
      indexes,
      uniqueIndexes,
      retiredColumns,
    }),
  });
}
