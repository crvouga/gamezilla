import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import {
  activeSpan,
  observeSyncNow,
} from '@pkgs/observability-root-shared-ts/span';
import { sqliteWireValue } from './sqlite-wire-value';

/** Stable stringify: recursively sorted keys, no undefined, arrays order-significant. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/** A value with `toJSON` (a driver's `Date`) hashes as it goes on the wire. */
function hasToJson(value: object): value is { toJSON(): unknown } {
  return typeof (value as { toJSON?: unknown }).toJSON === 'function';
}

function sortValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  // Without this a `Date` has no own keys and stringifies as `{}`.
  if (hasToJson(value)) return sortValue(value.toJSON());
  if (Array.isArray(value)) return value.map(sortValue);
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  // Null prototype so a `__proto__` key is copied as data, not as [[Prototype]].
  const out = Object.create(null) as Record<string, unknown>;
  for (const key of keys) {
    const v = obj[key];
    if (v !== undefined) out[key] = sortValue(v);
  }
  return out;
}

export function sha256Hex(text: string): string {
  return bytesToHex(sha256(utf8ToBytes(text)));
}

export function scopeHash(queryName: string, params: unknown): string {
  return sha256Hex(`${queryName}\0${canonicalJson(params)}`);
}

/**
 * A row as the client's SQLite holds it, columns in stable order. The server
 * hashes Postgres rows (`true`, jsonb objects, `Date`s) and the client
 * re-hashes the same rows read back from SQLite (`1`, JSON text, ISO
 * strings). A column's affinity changes the stored type too (a jsonb `true`
 * in a TEXT column reads back as `'1'`), so each value hashes as its text.
 */
function storedRow(row: Readonly<Record<string, unknown>>): string {
  const out = Object.create(null) as Record<string, string | null>;
  for (const key of Object.keys(row).sort()) {
    const v = row[key];
    if (v === undefined) continue;
    const stored = sqliteWireValue(v);
    out[key] = stored === null ? null : String(stored);
  }
  return JSON.stringify(out);
}

/**
 * Content hash: tables by name → rows by id → columns stable order, each
 * value as stored locally ({@link sqliteWireValue}).
 *
 * Builds one string (sorted once per row) then a single sha256 — avoids the
 * old path of allocating a full nested payload and re-sorting via
 * {@link canonicalJson}. Algorithm is opaque on the wire (CONTRACTS Fork A).
 */
function hashTables(
  tables: Readonly<Record<string, readonly Record<string, unknown>[]>>
): string {
  const parts: string[] = ['hqtv2'];
  const tableNames = Object.keys(tables).sort();
  for (const name of tableNames) {
    parts.push(name);
    const rows = [...(tables[name] ?? [])];
    observeSyncNow('sort', () =>
      rows.sort((a, b) => {
        const aid = String(a['id'] ?? '');
        const bid = String(b['id'] ?? '');
        return aid < bid ? -1 : aid > bid ? 1 : 0;
      })
    );
    parts.push(String(rows.length));
    observeSyncNow('encode', () => {
      for (const row of rows) parts.push(storedRow(row));
    });
  }
  const bytes = observeSyncNow('encode', () => utf8ToBytes(parts.join('\0')));
  activeSpan()?.setAttribute(ATTR.APP_SYNC_BYTES, bytes.byteLength);
  return observeSyncNow('digest', () => bytesToHex(sha256(bytes)));
}

/** Preserve the exact wire hash while measuring work independently of sampling. */
export function hashQueryTables(
  tables: Readonly<Record<string, readonly Record<string, unknown>[]>>
): string {
  return observeSyncNow('hash', () => hashTables(tables), {
    [ATTR.APP_SYNC_ROWS]: Object.values(tables).reduce(
      (sum, rows) => sum + rows.length,
      0
    ),
    [ATTR.APP_SYNC_TABLES]: Object.keys(tables).length,
  });
}
