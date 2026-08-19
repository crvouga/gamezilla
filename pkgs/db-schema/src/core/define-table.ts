import { assertSnakeCaseIdent } from './snake-case';
import type { ColumnType, DeprecationDef, IndexDef } from './types';
import { COLUMN_TYPE_SET, MANAGED_IMPLICIT_SET } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    if (MANAGED_IMPLICIT_SET.has(colName)) {
      throw new Error(
        `${path}: '${colName}' is engine-owned (implicit on every table)`
      );
    }
    if (typeof token !== 'string' || !COLUMN_TYPE_SET.has(token)) {
      throw new Error(
        `${path}: column type must be one of uuid|text|integer|boolean|timestamp|json`
      );
    }
    tableCols[colName] = token as ColumnType;
  }
  return tableCols;
}

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
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const path = `${field}[${i}]`;
    if (typeof entry === 'string') {
      out.push([tableName, entry]);
      continue;
    }
    if (!Array.isArray(entry) || entry.length === 0) {
      throw new Error(
        `${path}: index entry must be a column name or non-empty column tuple`
      );
    }
    if (!entry.every((x) => typeof x === 'string')) {
      throw new Error(`${path}: index column names must be strings`);
    }
    out.push([tableName, ...(entry as string[])]);
  }
  return out;
}

function normalizeDeprecations(
  tableName: string,
  entries:
    | readonly (readonly [string, string] | readonly [string])[]
    | undefined
): DeprecationDef[] {
  if (entries === undefined) return [];
  const out: DeprecationDef[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const path = `deprecations[${i}]`;
    if (!Array.isArray(entry)) {
      throw new Error(`${path}: deprecation must be [note] or [column, note]`);
    }
    if (entry.length === 1) {
      const [note] = entry;
      if (typeof note !== 'string' || note.length === 0) {
        throw new Error(`${path}: table deprecation note is required`);
      }
      out.push([tableName, note]);
      continue;
    }
    if (entry.length === 2) {
      const [column, note] = entry;
      if (typeof column !== 'string' || typeof note !== 'string') {
        throw new Error(
          `${path}: column deprecation must be [column, note] with strings`
        );
      }
      if (note.length === 0) {
        throw new Error(`${path}: note is required`);
      }
      out.push([tableName, column, note]);
      continue;
    }
    throw new Error(`${path}: deprecation must be [note] or [column, note]`);
  }
  return out;
}

export type TableDefInput = {
  readonly domain: string;
  readonly name: string;
  readonly columns: Record<string, ColumnType>;
  readonly indexes?: readonly (string | readonly string[])[];
  readonly uniqueIndexes?: readonly (string | readonly string[])[];
  readonly deprecations?: readonly (
    | readonly [string, string]
    | readonly [string]
  )[];
};

export type TableDefSlice = {
  readonly domain: string;
  readonly name: string;
  readonly columns: Record<string, ColumnType>;
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  readonly deprecations: readonly DeprecationDef[];
};

export type TableDef = {
  readonly domain: string;
  readonly name: string;
  readonly _slice: TableDefSlice;
};

/**
 * Declare a single domain table with optional per-table indexes and deprecations.
 */
export function defineTable(input: TableDefInput): TableDef {
  const path = `defineTable(${input.name})`;
  assertSnakeCaseIdent(input.name, `${path}.name`);
  assertMatchesDomain(input.name, input.domain, path);
  const columns = parseTableColumns(input.name, input.columns);
  const indexes = normalizeIndexEntries(input.name, 'indexes', input.indexes);
  const uniqueIndexes = normalizeIndexEntries(
    input.name,
    'uniqueIndexes',
    input.uniqueIndexes
  );
  const deprecations = normalizeDeprecations(input.name, input.deprecations);
  return Object.freeze({
    domain: input.domain,
    name: input.name,
    _slice: Object.freeze({
      domain: input.domain,
      name: input.name,
      columns,
      indexes,
      uniqueIndexes,
      deprecations,
    }),
  });
}
