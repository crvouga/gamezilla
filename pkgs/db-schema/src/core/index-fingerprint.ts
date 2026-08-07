import { createHash } from 'node:crypto';
import type {
  IndexDef,
  PackagePrefixedIndexName,
  ValidatedIdent,
} from './types';

const INDEX_NAME_RE = /^ix_[a-z][a-z0-9_]{0,39}_[0-9a-f]{16}$/;

export function indexFingerprintName(
  table: string,
  columns: readonly string[]
): PackagePrefixedIndexName {
  const canonical = `${table}\0${columns.join('\0')}`;
  const hex16 = createHash('sha256')
    .update(canonical)
    .digest('hex')
    .slice(0, 16);
  const tablePart = table.slice(0, 40);
  const name = `ix_${tablePart}_${hex16}`;
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

export function indexKey(def: IndexDef): string {
  return `${def[0]}\0${def.slice(1).join('\0')}`;
}

export function fingerprintForIndexDef(
  def: IndexDef
): PackagePrefixedIndexName {
  const [table, ...columns] = def;
  return indexFingerprintName(table, columns);
}

export function asValidatedIdent(name: string): ValidatedIdent {
  return name as ValidatedIdent;
}
