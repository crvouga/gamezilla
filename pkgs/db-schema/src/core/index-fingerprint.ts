import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { assertSnakeCaseIdent } from './snake-case';
import type {
  IndexDef,
  PackagePrefixedIndexName,
  PhysicalIdent,
  SchemaIdent,
} from './types';

const INDEX_NAME_RE = /^(?:ix|ux)_[a-z][a-z0-9_]{0,39}_[0-9a-f]{16}$/;
const PHYSICAL_IDENT_RE = /^[a-z_][a-z0-9_]*$/i;

export function indexFingerprintName(
  table: string,
  columns: readonly string[],
  unique = false
): PackagePrefixedIndexName {
  const prefix = unique ? 'ux' : 'ix';
  const canonical = `${prefix}\0${table}\0${columns.join('\0')}`;
  const hex16 = bytesToHex(sha256(utf8ToBytes(canonical))).slice(0, 16);
  const tablePart = table.slice(0, 40);
  const name = `${prefix}_${tablePart}_${hex16}`;
  return name as PackagePrefixedIndexName;
}

export function isPackageIndexName(
  name: string
): name is PackagePrefixedIndexName {
  return INDEX_NAME_RE.test(name);
}

export function asPackageIndexName(
  name: string
): PackagePrefixedIndexName | null {
  return isPackageIndexName(name) ? (name as PackagePrefixedIndexName) : null;
}

export function indexKey(def: IndexDef, unique = false): string {
  return `${unique ? 'u' : 'i'}\0${def[0]}\0${def.slice(1).join('\0')}`;
}

export function fingerprintForIndexDef(
  def: IndexDef,
  unique = false
): PackagePrefixedIndexName {
  const [table, ...columns] = def;
  return indexFingerprintName(table, columns, unique);
}

/** Assert snake_case schema identifier at planner boundaries. */
export function asSchemaIdent(name: string, path = 'ident'): SchemaIdent {
  assertSnakeCaseIdent(name, path);
  return name as SchemaIdent;
}

/** Physical catalog name (introspected extras, rebuild staging tables). */
export function asPhysicalIdent(name: string): PhysicalIdent {
  if (!PHYSICAL_IDENT_RE.test(name)) {
    throw new Error(`unsafe physical identifier: ${name}`);
  }
  if (name.length > 63) {
    throw new Error(`physical identifier exceeds 63 bytes: ${name}`);
  }
  return name as PhysicalIdent;
}

/** Reserved rebuild staging table name — never a user-declared table. */
export function rebuildOldTableIdent(table: string): PhysicalIdent {
  return asPhysicalIdent(`_old_${table}`);
}

/** @deprecated Prefer {@link asSchemaIdent}. */
export function asValidatedIdent(name: string): SchemaIdent {
  return asSchemaIdent(name);
}
