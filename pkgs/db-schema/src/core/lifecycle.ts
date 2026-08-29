import type { DialectSql } from './dialect-sql';
import { type DialectName, resolveDialectSql } from './dialect-sql';
import type { DeclaredColumn } from './types';

/**
 * Resolve a column's backfill expression for a dialect.
 * `renamedFrom` / `widenedFrom` imply a copy from the source column when no
 * explicit backfill is declared.
 */
export function resolveBackfillSql(
  col: DeclaredColumn,
  dialect: DialectName
): string | null {
  if (col.backfill !== undefined) {
    if ('from' in col.backfill) {
      return quoteIdent(col.backfill.from);
    }
    return resolveDialectSql(col.backfill.sql, dialect);
  }
  if (col.renamedFrom !== undefined) {
    return quoteIdent(col.renamedFrom);
  }
  if (col.widenedFrom !== undefined) {
    return quoteIdent(col.widenedFrom);
  }
  return null;
}

/** Safe identifier quoting for backfill copy expressions (no user SQL). */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function enumCheckSql(
  column: string,
  values: readonly string[]
): DialectSql {
  const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
  return `${quoteIdent(column)} IS NULL OR ${quoteIdent(column)} IN (${list})`;
}

export function enumCheckName(enumName: string, column: string): string {
  return `ck_${enumName}_${column}`.slice(0, 63);
}
