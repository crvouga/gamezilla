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

/** information_schema `udt_name` values that map to a logical token. */
export const PG_UDT_TO_TOKEN: Readonly<Record<string, ColumnType>> = {
  uuid: 'uuid',
  text: 'text',
  int8: 'integer',
  int4: 'integer',
  bool: 'boolean',
  timestamptz: 'timestamp',
  jsonb: 'json',
};

/** Map information_schema / pg type names back to logical tokens. */
export function pgTypeToToken(
  udtName: string,
  dataType: string
): ColumnType | null {
  const u = udtName.toLowerCase();
  const d = dataType.toLowerCase();
  const fromUdt = PG_UDT_TO_TOKEN[u];
  if (fromUdt) return fromUdt;
  if (d === 'uuid') return 'uuid';
  if (d === 'text') return 'text';
  if (d === 'bigint') return 'integer';
  if (d === 'integer') return 'integer';
  if (d === 'boolean') return 'boolean';
  if (d === 'timestamp with time zone') return 'timestamp';
  if (d === 'jsonb') return 'json';
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
