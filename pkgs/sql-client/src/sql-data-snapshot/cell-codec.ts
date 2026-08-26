/**
 * Encode/decode SQL cell values into JSON-canonical {@link SqlDumpValue}.
 * Aligns with db-schema type-map wire shapes (UUID/text string, bool boolean,
 * timestamptz ISO-8601, json nested JSON).
 */

import type { SqlDumpValue } from './types';

export function encodeSqlDumpCell(value: unknown): SqlDumpValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) {
    let binary = '';
    for (let i = 0; i < value.length; i += 1) {
      binary += String.fromCharCode(value[i]!);
    }
    return btoa(binary);
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeSqlDumpCell(item));
  }
  if (typeof value === 'object') {
    const out: Record<string, SqlDumpValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = encodeSqlDumpCell(entry);
    }
    return out;
  }
  return String(value);
}

export function rowToDumpValues(
  columns: readonly string[],
  row: Record<string, unknown>
): readonly SqlDumpValue[] {
  return columns.map((col) => encodeSqlDumpCell(row[col]));
}
