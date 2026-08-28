import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Stable stringify: recursively sorted keys, no undefined, arrays order-significant. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
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

/** Content hash: tables by name → rows by id → columns stable order. */
export function hashQueryTables(
  tables: Readonly<Record<string, readonly Record<string, unknown>[]>>
): string {
  const tableNames = Object.keys(tables).sort();
  const payload: Record<string, unknown[]> = {};
  for (const name of tableNames) {
    const rows = [...(tables[name] ?? [])];
    rows.sort((a, b) => {
      const aid = String(a['id'] ?? '');
      const bid = String(b['id'] ?? '');
      return aid < bid ? -1 : aid > bid ? 1 : 0;
    });
    payload[name] = rows.map((row) => {
      const keys = Object.keys(row).sort();
      const sorted: Record<string, unknown> = {};
      for (const k of keys) sorted[k] = row[k];
      return sorted;
    });
  }
  return sha256Hex(canonicalJson(payload));
}
