/**
 * Canonical dumps for cross-backend agreement.
 * Local type map (sql-client cannot depend on @pkgs/db-schema — cycle).
 */

import { encodeSqlDumpCell } from '../../../src/sql-data-snapshot/cell-codec';
import type { SqlDumpValue } from '../../../src/sql-data-snapshot/types';

export type LogicalColumnType =
  | 'uuid'
  | 'text'
  | 'integer'
  | 'boolean'
  | 'timestamp'
  | 'json'
  | 'real'
  | 'blob'
  | 'numeric'
  | 'date';

export const PG_DDL: Record<LogicalColumnType, string> = {
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

export const SQLITE_DDL: Record<LogicalColumnType, string> = {
  uuid: 'TEXT',
  text: 'TEXT',
  integer: 'INTEGER',
  boolean: 'INTEGER',
  timestamp: 'TEXT',
  json: 'TEXT',
  real: 'REAL',
  blob: 'BLOB',
  numeric: 'TEXT',
  date: 'TEXT',
};

function canonBoolean(value: unknown): SqlDumpValue | undefined {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (value === null || value === undefined) return null;
  return undefined;
}

function canonInteger(value: unknown): SqlDumpValue | undefined {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) return undefined;
  const asNumber = Number(value);
  if (Number.isSafeInteger(asNumber) && String(asNumber) === value) {
    return asNumber;
  }
  return value;
}

function canonNumeric(value: unknown): SqlDumpValue | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value);
  }
  if (typeof value !== 'string') return undefined;
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && String(asNumber) === value) {
    return asNumber;
  }
  return value;
}

function canonTemporal(
  value: unknown,
  columnType: 'timestamp' | 'date'
): SqlDumpValue | undefined {
  const toCanon = (iso: string): string =>
    columnType === 'date' ? iso.slice(0, 10) : iso;
  if (value instanceof Date) return toCanon(value.toISOString());
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return toCanon(new Date(parsed).toISOString());
}

function canonReal(value: unknown): SqlDumpValue | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value)) return String(value);
  // Cross-engine float text/binary differ in the last ULPs.
  return Math.round(value * 1e6) / 1e6;
}

function canonJson(value: unknown): SqlDumpValue | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    return encodeSqlDumpCell(JSON.parse(value) as unknown);
  } catch {
    return value;
  }
}

/** Normalize dialect wire cells into a comparable dump value. */
export function canonicalizeCell(
  value: unknown,
  columnType: LogicalColumnType
): SqlDumpValue {
  if (typeof value === 'bigint') {
    throw new Error(
      'canonicalizeCell: bigint must be normalized before dump comparison'
    );
  }
  if (columnType === 'boolean') {
    return canonBoolean(value) ?? encodeSqlDumpCell(value);
  }
  if (columnType === 'integer') {
    return canonInteger(value) ?? encodeSqlDumpCell(value);
  }
  if (columnType === 'numeric') {
    return canonNumeric(value) ?? encodeSqlDumpCell(value);
  }
  if (columnType === 'timestamp' || columnType === 'date') {
    return canonTemporal(value, columnType) ?? encodeSqlDumpCell(value);
  }
  if (columnType === 'real') {
    return canonReal(value) ?? encodeSqlDumpCell(value);
  }
  if (columnType === 'json') {
    return canonJson(value) ?? encodeSqlDumpCell(value);
  }
  if (columnType === 'blob' && value instanceof Uint8Array) {
    return encodeSqlDumpCell(value);
  }
  return encodeSqlDumpCell(value);
}

export function canonicalizeRow(
  row: Record<string, unknown>,
  columns: readonly {
    readonly name: string;
    readonly type: LogicalColumnType;
  }[]
): Record<string, SqlDumpValue> {
  const out: Record<string, SqlDumpValue> = {};
  for (const col of columns) {
    out[col.name] = canonicalizeCell(row[col.name], col.type);
  }
  return out;
}

export function canonicalizeRows(
  rows: readonly Record<string, unknown>[],
  columns: readonly {
    readonly name: string;
    readonly type: LogicalColumnType;
  }[]
): readonly Record<string, SqlDumpValue>[] {
  return rows.map((row) => canonicalizeRow(row, columns));
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeys(obj[key]);
  }
  return out;
}
