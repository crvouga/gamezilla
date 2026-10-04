import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assert } from '@pkgs/assert-shared/singleton';
import { assertWithinLimit, LIMITS } from './limits';
import { asOwnedIndexName } from './types';
import type { IndexDefinition, OwnedIndexName } from './types';

const OWNED_PREFIX = 'autoidx_';
const OWNED_NAME_RE = /^autoidx_[a-z][a-z0-9_]{0,39}_[0-9a-f]{8}$/;

export function isOwnedName(name: string): name is OwnedIndexName {
  assert.ok(typeof name === 'string', 'isOwnedName: name must be string');
  return OWNED_NAME_RE.test(name);
}

export function assertIsOwnedName(
  name: string
): asserts name is OwnedIndexName {
  assert.ok(isOwnedName(name), `not an owned autoidx name: ${name}`);
  assert.ok(
    !name.startsWith('ix_'),
    'owned name must not use db-schema ix_ prefix'
  );
  assert.ok(
    !name.startsWith('ux_'),
    'owned name must not use db-schema ux_ prefix'
  );
}

/**
 * Canonical bytes for hashing: table, cols(+order+collation+opclass),
 * include (sorted), predicate.
 */
export function canonicalDefinition(def: IndexDefinition): string {
  assert.ok(def.table.length > 0, 'definition.table required');
  assert.ok(def.columns.length > 0, 'definition.columns required');
  assertWithinLimit(
    def.columns.length,
    LIMITS.maxColumnsPerIndex,
    'definition.columns'
  );
  assertWithinLimit(
    def.include.length,
    LIMITS.maxIncludeColumns,
    'definition.include'
  );
  const cols = def.columns.map((c) => {
    assert.ok(c.name.length > 0, 'column name required');
    const coll = c.collation ?? '';
    const opc = c.opclass ?? '';
    return `${c.name}:${c.order}:${coll}:${opc}`;
  });
  const include = [...def.include].sort();
  const pred = def.predicate ?? '';
  assertWithinLimit(pred.length, LIMITS.maxPredicateLength, 'predicate');
  return [def.table, cols.join(','), include.join(','), pred].join('\0');
}

export function ownedIndexName(def: IndexDefinition): OwnedIndexName {
  const canonical = canonicalDefinition(def);
  const hex = bytesToHex(sha256(utf8ToBytes(canonical))).slice(
    0,
    LIMITS.hash8HexLength
  );
  assert.ok(hex.length === LIMITS.hash8HexLength, 'hash8 length');
  const tablePart = def.table.slice(0, LIMITS.maxTableNameLength);
  assert.ok(/^[a-z][a-z0-9_]*$/.test(tablePart), 'table must be snake_case', {
    tablePart,
  });
  const name = `${OWNED_PREFIX}${tablePart}_${hex}`;
  assert.ok(
    name.length <= LIMITS.maxIndexNameLength,
    `index name too long: ${name}`
  );
  assertIsOwnedName(name);
  return asOwnedIndexName(name);
}

/** Definitions that hash equal must produce the same name. */
export function definitionsEqual(
  a: IndexDefinition,
  b: IndexDefinition
): boolean {
  assert.ok(a !== undefined && b !== undefined, 'definitions required');
  return canonicalDefinition(a) === canonicalDefinition(b);
}
