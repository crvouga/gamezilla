import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type {
  IndexDef,
  PackagePrefixedIndexName,
  ValidatedIdent,
} from './types';

const INDEX_NAME_RE = /^(?:ix|ux)_[a-z][a-z0-9_]{0,39}_[0-9a-f]{16}$/;

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

export function asValidatedIdent(name: string): ValidatedIdent {
  return name as ValidatedIdent;
}
