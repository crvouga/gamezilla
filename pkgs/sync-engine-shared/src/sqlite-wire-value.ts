import type { Value } from '@pkgs/sql-shared/sql';

/**
 * A column value as the client's SQLite stores it. Postgres rows arrive with
 * booleans, jsonb objects and `Date`s; the web SQLite only accepts
 * string | number | null | Uint8Array binds.
 */
export function sqliteWireValue(value: unknown): Value {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
