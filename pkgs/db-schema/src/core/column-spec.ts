import { assertDialectSqlShape } from './dialect-sql';
import {
  assertPhysicalPostgres,
  assertPhysicalSqlite,
  normalizePhysicalSqlite,
} from './physical-types';
import { assertSnakeCaseIdent } from './snake-case';
import type { BackfillSpec, ColumnType, DeclaredColumn } from './types';
import { COLUMN_TYPE_SET, MANAGED_IMPLICIT_SET } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type ColumnSpecInput =
  | ColumnType
  | {
      readonly type: ColumnType;
      readonly renamedFrom?: string;
      readonly widenedFrom?: string;
      readonly backfill?: BackfillSpec;
      readonly postgres?: string;
      readonly sqlite?: string;
    };

const COLUMN_SPEC_KEYS = new Set([
  'type',
  'renamedFrom',
  'widenedFrom',
  'backfill',
  'postgres',
  'sqlite',
  // Already-parsed DeclaredColumn keys: `registerTables` re-validates the
  // columns `defineTable` built, so both spellings must be accepted.
  'physicalPostgres',
  'physicalSqlite',
]);

function parseBackfill(value: unknown, path: string): BackfillSpec {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: backfill must be { from } or { sql }`);
  }
  const keys = Object.keys(value);
  if (keys.includes('from') && keys.includes('sql')) {
    throw new Error(`${path}: backfill cannot have both from and sql`);
  }
  if (typeof value['from'] === 'string') {
    assertSnakeCaseIdent(value['from'], `${path}.from`);
    return { from: value['from'] };
  }
  if (value['sql'] !== undefined) {
    return { sql: assertDialectSqlShape(value['sql'], `${path}.sql`) };
  }
  throw new Error(`${path}: backfill must be { from } or { sql }`);
}

export function assertColumnType(token: unknown, path: string): ColumnType {
  if (typeof token !== 'string' || !COLUMN_TYPE_SET.has(token)) {
    throw new Error(
      `${path}: column type must be one of ${[...COLUMN_TYPE_SET].join('|')}`
    );
  }
  return token as ColumnType;
}

function assertObjectSpecKeys(
  raw: Record<string, unknown>,
  path: string
): void {
  for (const key of Object.keys(raw)) {
    if (!COLUMN_SPEC_KEYS.has(key)) {
      throw new Error(`${path}: unknown column key '${key}'`);
    }
  }
}

function assertLifecycleIdents(
  raw: Record<string, unknown>,
  path: string
): void {
  if (typeof raw['renamedFrom'] === 'string') {
    assertSnakeCaseIdent(raw['renamedFrom'], `${path}.renamedFrom`);
  }
  if (typeof raw['widenedFrom'] === 'string') {
    assertSnakeCaseIdent(raw['widenedFrom'], `${path}.widenedFrom`);
  }
}

function buildObjectColumn(
  raw: Record<string, unknown>,
  path: string,
  type: ColumnType
): DeclaredColumn {
  return {
    type,
    ...(typeof raw['renamedFrom'] === 'string'
      ? { renamedFrom: raw['renamedFrom'] }
      : {}),
    ...(typeof raw['widenedFrom'] === 'string'
      ? { widenedFrom: raw['widenedFrom'] }
      : {}),
    ...(raw['backfill'] !== undefined
      ? { backfill: parseBackfill(raw['backfill'], `${path}.backfill`) }
      : {}),
    ...(typeof raw['postgres'] === 'string'
      ? { physicalPostgres: raw['postgres'] }
      : typeof raw['physicalPostgres'] === 'string'
        ? { physicalPostgres: raw['physicalPostgres'] }
        : {}),
    ...(typeof raw['sqlite'] === 'string'
      ? { physicalSqlite: normalizePhysicalSqlite(raw['sqlite']) }
      : typeof raw['physicalSqlite'] === 'string'
        ? { physicalSqlite: normalizePhysicalSqlite(raw['physicalSqlite']) }
        : {}),
  };
}

function assertPhysicalOverrides(
  raw: Record<string, unknown>,
  path: string
): void {
  if (typeof raw['postgres'] === 'string') {
    assertPhysicalPostgres(raw['postgres'], `${path}.postgres`);
  }
  if (typeof raw['sqlite'] === 'string') {
    assertPhysicalSqlite(raw['sqlite'], `${path}.sqlite`);
  }
  if (typeof raw['physicalPostgres'] === 'string') {
    assertPhysicalPostgres(raw['physicalPostgres'], `${path}.physicalPostgres`);
  }
  if (typeof raw['physicalSqlite'] === 'string') {
    assertPhysicalSqlite(raw['physicalSqlite'], `${path}.physicalSqlite`);
  }
}

function validateLifecycleSource(args: {
  readonly path: string;
  readonly source: string;
  readonly liveCols: ReadonlySet<string>;
  readonly retiredCols: ReadonlySet<string>;
}): void {
  const { path, source, liveCols, retiredCols } = args;
  if (MANAGED_IMPLICIT_SET.has(source)) {
    throw new Error(`${path}: lifecycle source '${source}' is engine-owned`);
  }
  if (liveCols.has(source)) {
    throw new Error(
      `${path}: lifecycle source '${source}' is still declared — remove it and add a retiredColumns tombstone`
    );
  }
  if (!retiredCols.has(source)) {
    throw new Error(
      `${path}: lifecycle source '${source}' requires a matching retiredColumns entry`
    );
  }
}

function validateBackfillFrom(args: {
  readonly path: string;
  readonly from: string;
  readonly tableName: string;
  readonly liveCols: ReadonlySet<string>;
  readonly retiredCols: ReadonlySet<string>;
}): void {
  const { path, from, tableName, liveCols, retiredCols } = args;
  if (MANAGED_IMPLICIT_SET.has(from)) {
    throw new Error(`${path}.backfill.from: '${from}' is engine-owned`);
  }
  if (!liveCols.has(from) && !retiredCols.has(from)) {
    throw new Error(
      `${path}.backfill.from: unknown column '${from}' on table '${tableName}'`
    );
  }
}

function validateDeclaredColumnLifecycle(args: {
  readonly tableName: string;
  readonly colName: string;
  readonly col: DeclaredColumn;
  readonly liveCols: ReadonlySet<string>;
  readonly retiredCols: ReadonlySet<string>;
}): void {
  const { tableName, colName, col, liveCols, retiredCols } = args;
  const path = `tables.${tableName}.${colName}`;
  if (col.renamedFrom !== undefined && col.widenedFrom !== undefined) {
    throw new Error(`${path}: cannot declare both renamedFrom and widenedFrom`);
  }
  const source = col.renamedFrom ?? col.widenedFrom;
  if (source !== undefined) {
    validateLifecycleSource({ path, source, liveCols, retiredCols });
  }
  if (col.renamedFrom !== undefined && col.backfill !== undefined) {
    throw new Error(
      `${path}: renamedFrom implies copy backfill — do not declare backfill separately`
    );
  }
  if (col.backfill !== undefined && 'from' in col.backfill) {
    validateBackfillFrom({
      path,
      from: col.backfill.from,
      tableName,
      liveCols,
      retiredCols,
    });
  }
}

/**
 * Validate lifecycle metadata against declared + retired columns.
 * Call after all columns and retiredColumns for a table are known.
 */
export function validateColumnLifecycle(args: {
  readonly tableName: string;
  readonly columns: Record<string, DeclaredColumn>;
  readonly retiredCols: ReadonlySet<string>;
}): void {
  const { tableName, columns, retiredCols } = args;
  const liveCols = new Set(Object.keys(columns));
  for (const [colName, col] of Object.entries(columns)) {
    validateDeclaredColumnLifecycle({
      tableName,
      colName,
      col,
      liveCols,
      retiredCols,
    });
  }
}

/**
 * Parse a column declaration (string token or object spec) into DeclaredColumn.
 */
export function parseColumnSpec(
  tableName: string,
  colName: string,
  raw: unknown
): DeclaredColumn {
  const path = `tables.${tableName}.${colName}`;
  assertSnakeCaseIdent(colName, path);
  if (MANAGED_IMPLICIT_SET.has(colName)) {
    throw new Error(
      `${path}: '${colName}' is engine-owned (implicit on every table)`
    );
  }
  if (typeof raw === 'string') {
    return { type: assertColumnType(raw, path) };
  }
  if (!isPlainObject(raw)) {
    throw new Error(`${path}: column must be a type token or object spec`);
  }
  assertObjectSpecKeys(raw, path);
  const type = assertColumnType(raw['type'], path);
  assertLifecycleIdents(raw, path);
  assertPhysicalOverrides(raw, path);
  return buildObjectColumn(raw, path, type);
}

export function parseTableColumnMap(
  tableName: string,
  cols: unknown
): Record<string, DeclaredColumn> {
  if (!isPlainObject(cols)) {
    throw new Error(`tables.${tableName}: columns must be an object`);
  }
  const tableCols: Record<string, DeclaredColumn> = {};
  for (const [colName, raw] of Object.entries(cols)) {
    tableCols[colName] = parseColumnSpec(tableName, colName, raw);
  }
  return tableCols;
}
