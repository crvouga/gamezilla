import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assert } from '@pkgs/assert-shared/singleton';
import { assertWithinLimit, LIMITS } from './limits';

/**
 * Normalize SQL for fingerprinting: collapse whitespace, strip comments,
 * collapse `IN (?,?,?)` → `IN (?)` so list arity is not a shape.
 */
export function normalizeSql(sql: string): string {
  assert.ok(typeof sql === 'string', 'normalizeSql: sql must be string');
  assert.ok(sql.length > 0, 'normalizeSql: sql must be non-empty');
  let s = sql;
  // Block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Line comments
  s = s.replace(/--[^\n]*/g, ' ');
  // Collapse IN lists of placeholders
  s = s.replace(
    /\bIN\s*\(\s*(?:\?|\$\d+|:\d+)(?:\s*,\s*(?:\?|\$\d+|:\d+))*\s*\)/gi,
    'IN (?)'
  );
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // Lowercase keywords-ish: full lower for stability
  s = s.toLowerCase();
  assertWithinLimit(s.length, LIMITS.maxSqlFingerprintLength, 'normalized sql');
  assert.ok(s.length > 0, 'normalizeSql: normalized sql empty');
  return s;
}

export function fingerprintSql(sql: string): string {
  const normalized = normalizeSql(sql);
  const hex = bytesToHex(sha256(utf8ToBytes(normalized)));
  assert.ok(hex.length === 64, 'fingerprint must be sha256 hex');
  return hex;
}
