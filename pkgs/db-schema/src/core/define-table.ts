import {
  type ColumnSpecInput,
  parseTableColumnMap,
  validateColumnLifecycle,
} from './column-spec';
import { assertDialectSqlShape, type DialectSql } from './dialect-sql';
import { assertSnakeCaseIdent } from './snake-case';
import type {
  CheckDef,
  DeclaredColumn,
  DeprecationDef,
  IndexDef,
} from './types';

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

function normalizeChecks(
  tableName: string,
  entries:
    | readonly { readonly name: string; readonly sql: DialectSql }[]
    | undefined
): CheckDef[] {
  if (entries === undefined) return [];
  const out: CheckDef[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const path = `checks[${i}]`;
    assertSnakeCaseIdent(entry.name, `${path}.name`);
    out.push({
      name: entry.name,
      table: tableName,
      sql: assertDialectSqlShape(entry.sql, `${path}.sql`),
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
  readonly deprecations?: readonly (
    | readonly [string, string]
    | readonly [string]
  )[];
  readonly checks?: readonly {
    readonly name: string;
    readonly sql: DialectSql;
  }[];
};

export type TableDefSlice = {
  readonly domain: string;
  readonly name: string;
  readonly columns: Record<string, DeclaredColumn>;
  readonly indexes: readonly IndexDef[];
  readonly uniqueIndexes: readonly IndexDef[];
  readonly deprecations: readonly DeprecationDef[];
  readonly checks: readonly CheckDef[];
};

export type TableDef = {
  readonly domain: string;
  readonly name: string;
  readonly _slice: TableDefSlice;
  readonly kind: 'table';
};

/**
 * Declare a single domain table with optional per-table indexes and deprecations.
 */
export function defineTable(input: TableDefInput): TableDef {
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
  const deprecations = normalizeDeprecations(input.name, input.deprecations);
  const checks = normalizeChecks(input.name, input.checks);
  validateColumnLifecycle({
    tableName: input.name,
    columns,
    deprecations,
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
      deprecations,
      checks,
    }),
  });
}
