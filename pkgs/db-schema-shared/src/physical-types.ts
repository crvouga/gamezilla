import { PG_TYPE_SQL, SQLITE_TYPE_SQL } from './type-map';
import type { ColumnType, SqlitePhysicalType } from './types';

/** Allowed Postgres physical type strings for column overrides. */
export const ALLOWED_PG_PHYSICAL: ReadonlySet<string> = new Set([
  ...Object.values(PG_TYPE_SQL),
  'int4',
  'varchar',
  'character varying',
]);

/** Allowed SQLite STRICT physical type strings for column overrides. */
export const ALLOWED_SQLITE_PHYSICAL: ReadonlySet<string> = new Set([
  ...Object.values(SQLITE_TYPE_SQL),
] satisfies SqlitePhysicalType[]);

export function assertPhysicalPostgres(
  value: string,
  path: string
): asserts value is string {
  const normalized = value.toLowerCase();
  if (!ALLOWED_PG_PHYSICAL.has(value) && !ALLOWED_PG_PHYSICAL.has(normalized)) {
    throw new Error(
      `${path}: postgres physical type '${value}' is not allowlisted (use a logical ColumnType token instead)`
    );
  }
}

export function assertPhysicalSqlite(
  value: string,
  path: string
): asserts value is string {
  const normalized = value.toUpperCase();
  if (!ALLOWED_SQLITE_PHYSICAL.has(normalized)) {
    throw new Error(
      `${path}: sqlite physical type '${value}' must be one of TEXT|INTEGER|REAL|BLOB`
    );
  }
}

export function normalizePhysicalSqlite(value: string): SqlitePhysicalType {
  const upper = value.toUpperCase();
  if (
    upper === 'TEXT' ||
    upper === 'INTEGER' ||
    upper === 'REAL' ||
    upper === 'BLOB'
  ) {
    return upper;
  }
  throw new Error(`invalid sqlite physical type '${value}'`);
}

export function defaultPhysicalPostgres(token: ColumnType): string {
  return PG_TYPE_SQL[token];
}

export function defaultPhysicalSqlite(token: ColumnType): SqlitePhysicalType {
  return SQLITE_TYPE_SQL[token];
}
