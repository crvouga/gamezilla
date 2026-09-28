import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

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
  // Without this a `Date` has no own keys and hashes as `{}`, while the client
  // hashes the ISO string it received — the scope never reads as in sync.
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
 * Content hash: tables by name → rows by id → columns stable order.
 *
 * Builds one string (sorted once per row) then a single sha256 — avoids the
 * old path of allocating a full nested payload and re-sorting via
 * {@link canonicalJson}. Algorithm is opaque on the wire (CONTRACTS Fork A).
 */
export function hashQueryTables(
  tables: Readonly<Record<string, readonly Record<string, unknown>[]>>
): string {
  const parts: string[] = ['hqtv2'];
  const tableNames = Object.keys(tables).sort();
  for (const name of tableNames) {
    parts.push(name);
    const rows = [...(tables[name] ?? [])];
    rows.sort((a, b) => {
      const aid = String(a['id'] ?? '');
      const bid = String(b['id'] ?? '');
      return aid < bid ? -1 : aid > bid ? 1 : 0;
    });
    parts.push(String(rows.length));
    for (const row of rows) {
      // sortValue once — do not run canonicalJson over a giant outer object.
      parts.push(JSON.stringify(sortValue(row)));
    }
  }
  return sha256Hex(parts.join('\0'));
}
