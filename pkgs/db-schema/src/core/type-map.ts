import type { ColumnType, SqlitePhysicalType } from './types';

export const PG_TYPE_SQL: Record<ColumnType, string> = {
  uuid: 'uuid',
  text: 'text',
  integer: 'bigint',
  boolean: 'boolean',
  timestamp: 'timestamptz',
  json: 'jsonb',
  real: 'double precision',
  blob: 'bytea',
  numeric: 'numeric',
  date: 'date',
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
  real: 'REAL',
  blob: 'BLOB',
  numeric: 'TEXT',
  date: 'TEXT',
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
  float8: 'real',
  bytea: 'blob',
  numeric: 'numeric',
  date: 'date',
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
  if (d === 'double precision' || d === 'real') return 'real';
  if (d === 'bytea') return 'blob';
  if (d === 'numeric' || d === 'decimal') return 'numeric';
  if (d === 'date') return 'date';
  return null;
}

export function sqlitePhysicalOf(token: ColumnType): SqlitePhysicalType {
  return SQLITE_TYPE_SQL[token];
}

export function normalizeSqliteType(
  declared: string
): SqlitePhysicalType | null {
  const t = declared.toUpperCase();
  if (t === 'TEXT' || t === 'INTEGER' || t === 'REAL' || t === 'BLOB') {
    return t;
  }
  return null;
}
/**
 * Alias → canonical physical type. Canonical values are exactly the forms
 * used by {@link PG_TYPE_SQL} plus the allowlisted overrides in
 * `physical-types.ts`, so a declared column and an introspected `udt_name`
 * compare equal iff they are the same physical type.
 */
export const PG_PHYSICAL_ALIASES: Readonly<Record<string, string>> = {
  int8: 'bigint',
  bool: 'boolean',
  'character varying': 'varchar',
  'timestamp with time zone': 'timestamptz',
};

/** Canonicalize a Postgres physical type name (`udt_name` or declared form). */
export function normalizePgPhysical(value: string): string {
  const lower = value.toLowerCase();
  return PG_PHYSICAL_ALIASES[lower] ?? lower;
}
