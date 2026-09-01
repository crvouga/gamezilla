import { assertDialectSqlShape, type DialectSql } from './dialect-sql';
import {
  assertPhysicalPostgres,
  assertPhysicalSqlite,
  normalizePhysicalSqlite,
} from './physical-types';
import { assertSnakeCaseIdent } from './snake-case';
import type {
  BackfillSpec,
  ColumnType,
  DeclaredColumn,
  DeprecationDef,
  ForeignKeyRef,
  GeneratedSpec,
} from './types';
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
      readonly references?: ForeignKeyRef;
      readonly generated?: {
        readonly expr: DialectSql;
        readonly stored?: boolean;
      };
      readonly postgres?: string;
      readonly sqlite?: string;
      readonly enumName?: string;
      readonly arrayOf?: ColumnType;
    };

const COLUMN_SPEC_KEYS = new Set([
  'type',
  'renamedFrom',
  'widenedFrom',
  'backfill',
  'references',
  'generated',
  'postgres',
  'sqlite',
  'enumName',
  'arrayOf',
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

function parseGenerated(value: unknown, path: string): GeneratedSpec {
  if (!isPlainObject(value) || value['expr'] === undefined) {
    throw new Error(`${path}: generated must be { expr, stored? }`);
  }
  return {
    expr: assertDialectSqlShape(value['expr'], `${path}.expr`),
    stored: value['stored'] === undefined ? true : Boolean(value['stored']),
  };
}

function parseReferences(value: unknown, path: string): ForeignKeyRef {
  if (!isPlainObject(value)) {
    throw new Error(`${path}: references must be { table, column }`);
  }
  if (
    typeof value['table'] !== 'string' ||
    typeof value['column'] !== 'string'
  ) {
    throw new Error(`${path}: references.table and references.column required`);
  }
  assertSnakeCaseIdent(value['table'], `${path}.table`);
  assertSnakeCaseIdent(value['column'], `${path}.column`);
  return { table: value['table'], column: value['column'] };
}

function assertColumnType(token: unknown, path: string): ColumnType {
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
  if (typeof raw['enumName'] === 'string') {
    assertSnakeCaseIdent(raw['enumName'], `${path}.enumName`);
  }
  if (raw['arrayOf'] !== undefined) {
    assertColumnType(raw['arrayOf'], `${path}.arrayOf`);
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
    ...(raw['references'] !== undefined
      ? { references: parseReferences(raw['references'], `${path}.references`) }
      : {}),
    ...(raw['generated'] !== undefined
      ? { generated: parseGenerated(raw['generated'], `${path}.generated`) }
      : {}),
    ...(typeof raw['postgres'] === 'string'
      ? { physicalPostgres: raw['postgres'] }
      : {}),
    ...(typeof raw['sqlite'] === 'string'
      ? { physicalSqlite: normalizePhysicalSqlite(raw['sqlite']) }
      : {}),
    ...(typeof raw['enumName'] === 'string'
      ? { enumName: raw['enumName'] }
      : {}),
    ...(typeof raw['arrayOf'] === 'string'
      ? { arrayOf: raw['arrayOf'] as ColumnType }
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
}

function validateLifecycleSource(args: {
  readonly path: string;
  readonly source: string;
  readonly liveCols: ReadonlySet<string>;
  readonly deprecatedCols: ReadonlySet<string>;
}): void {
  const { path, source, liveCols, deprecatedCols } = args;
  if (MANAGED_IMPLICIT_SET.has(source)) {
    throw new Error(`${path}: lifecycle source '${source}' is engine-owned`);
  }
  if (liveCols.has(source)) {
    throw new Error(
      `${path}: lifecycle source '${source}' is still declared — remove it and add a deprecation tombstone`
    );
  }
  if (!deprecatedCols.has(source)) {
    throw new Error(
      `${path}: lifecycle source '${source}' requires a matching deprecation entry`
    );
  }
}

function validateBackfillFrom(args: {
  readonly path: string;
  readonly from: string;
  readonly tableName: string;
  readonly liveCols: ReadonlySet<string>;
  readonly deprecatedCols: ReadonlySet<string>;
}): void {
  const { path, from, tableName, liveCols, deprecatedCols } = args;
  if (MANAGED_IMPLICIT_SET.has(from)) {
    throw new Error(`${path}.backfill.from: '${from}' is engine-owned`);
  }
  if (!liveCols.has(from) && !deprecatedCols.has(from)) {
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
  readonly deprecatedCols: ReadonlySet<string>;
}): void {
  const { tableName, colName, col, liveCols, deprecatedCols } = args;
  const path = `tables.${tableName}.${colName}`;
  if (col.renamedFrom !== undefined && col.widenedFrom !== undefined) {
    throw new Error(`${path}: cannot declare both renamedFrom and widenedFrom`);
  }
  const source = col.renamedFrom ?? col.widenedFrom;
  if (source !== undefined) {
    validateLifecycleSource({ path, source, liveCols, deprecatedCols });
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
      deprecatedCols,
    });
  }
}

/**
 * Validate lifecycle metadata against declared + deprecated columns.
 * Call after all columns and deprecations for a table are known.
 */
export function validateColumnLifecycle(args: {
  readonly tableName: string;
  readonly columns: Record<string, DeclaredColumn>;
  readonly deprecations: readonly DeprecationDef[];
}): void {
  const { tableName, columns, deprecations } = args;
  const deprecatedCols = new Set<string>();
  for (const dep of deprecations) {
    if (dep.length === 3 && dep[0] === tableName) {
      deprecatedCols.add(dep[1]);
    }
  }
  const liveCols = new Set(Object.keys(columns));

  for (const [colName, col] of Object.entries(columns)) {
    validateDeclaredColumnLifecycle({
      tableName,
      colName,
      col,
      liveCols,
      deprecatedCols,
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
