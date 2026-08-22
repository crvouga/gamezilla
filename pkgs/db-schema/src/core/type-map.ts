import type { ColumnType, SqlitePhysicalType } from './types';

export const PG_TYPE_SQL: Record<ColumnType, string> = {
  uuid: 'uuid',
  text: 'text',
  integer: 'bigint',
  boolean: 'boolean',
  timestamp: 'timestamptz',
  json: 'jsonb',
};

export const SQLITE_TYPE_SQL: Record<ColumnType, SqlitePhysicalType> = {
  uuid: 'TEXT',
  text: 'TEXT',
  integer: 'INTEGER',
  boolean: 'INTEGER',
  // ISO-8601 strings on the wire (Postgres timestamptz → JSON). STRICT rejects
  // TEXT into INTEGER, so local physical type must be TEXT.
  timestamp: 'TEXT',
  json: 'TEXT',
};

/** Map information_schema / pg type names back to logical tokens. */
export function pgTypeToToken(
  udtName: string,
  dataType: string
): ColumnType | null {
  const u = udtName.toLowerCase();
  const d = dataType.toLowerCase();
  if (u === 'uuid' || d === 'uuid') return 'uuid';
  if (u === 'text' || d === 'text') return 'text';
  if (u === 'int8' || d === 'bigint') return 'integer';
  if (u === 'int4' || d === 'integer') return 'integer';
  if (u === 'bool' || d === 'boolean') return 'boolean';
  if (u === 'timestamptz' || d === 'timestamp with time zone')
    return 'timestamp';
  if (u === 'jsonb' || d === 'jsonb') return 'json';
  return null;
}

export function sqlitePhysicalOf(token: ColumnType): SqlitePhysicalType {
  return SQLITE_TYPE_SQL[token];
}

export function normalizeSqliteType(
  declared: string
): SqlitePhysicalType | null {
  const t = declared.toUpperCase();
  if (t === 'TEXT' || t === 'INTEGER') return t;
  return null;
}
