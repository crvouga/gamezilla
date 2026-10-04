import type {
  CreateTableColumn,
  ServerOperation,
} from '@pkgs/db-schema-shared/operations';
import { PG_TYPE_SQL } from '@pkgs/db-schema-shared/type-map';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql, { ident, join, raw } from '@pkgs/sql-shared/sql';

function pgTypeOf(col: {
  type: keyof typeof PG_TYPE_SQL;
  physicalPostgres?: string;
}): Sql<void> {
  if (col.physicalPostgres !== undefined) {
    return raw(col.physicalPostgres);
  }
  return raw(PG_TYPE_SQL[col.type]);
}

function columnDdl(col: CreateTableColumn): Sql<void> {
  const typeSql = pgTypeOf(col);
  if (col.isPrimaryKey) {
    return sql`${ident(col.name)} ${typeSql} primary key`;
  }
  return sql`${ident(col.name)} ${typeSql}`;
}

/**
 * Exhaustive emitter for server operations. Adding a destructive variant to
 * ServerOperation forces a compile error here (no default case).
 */
export function emitServerOperation(
  op: ServerOperation,
  options?: { readonly concurrently?: boolean }
): Sql<unknown> {
  const concurrently = options?.concurrently ?? true;
  switch (op.kind) {
    case 'create_table': {
      const cols = op.columns.map((c) => columnDdl(c));
      return sql`CREATE TABLE IF NOT EXISTS ${ident(op.table)} (${join(cols, ', ')})`;
    }
    case 'add_column': {
      const typeSql = pgTypeOf(op);
      return sql`ALTER TABLE ${ident(op.table)} ADD COLUMN IF NOT EXISTS ${ident(op.column)} ${typeSql}`;
    }
    case 'backfill': {
      return sql`UPDATE ${ident(op.table)} SET ${ident(op.column)} = ${raw(op.expression)} WHERE ${ident(op.column)} IS NULL`;
    }
    case 'create_index': {
      const cols = op.columns.map((c) => ident(c));
      const uniqueKw = op.unique ? raw('UNIQUE ') : raw('');
      if (concurrently) {
        return sql`CREATE ${uniqueKw}INDEX CONCURRENTLY IF NOT EXISTS ${ident(op.name)} ON ${ident(op.table)} (${join(cols, ', ')})`;
      }
      return sql`CREATE ${uniqueKw}INDEX IF NOT EXISTS ${ident(op.name)} ON ${ident(op.table)} (${join(cols, ', ')})`;
    }
    case 'drop_index': {
      if (concurrently) {
        return sql`DROP INDEX CONCURRENTLY IF EXISTS ${ident(op.name)}`;
      }
      return sql`DROP INDEX IF EXISTS ${ident(op.name)}`;
    }
    case 'drop_not_null':
      return sql`ALTER TABLE ${ident(op.table)} ALTER COLUMN ${ident(op.column)} DROP NOT NULL`;
    case 'widen_integer':
      return sql`ALTER TABLE ${ident(op.table)} ALTER COLUMN ${ident(op.column)} TYPE bigint`;
    case 'drop_default':
      return sql`ALTER TABLE ${ident(op.table)} ALTER COLUMN ${ident(op.column)} DROP DEFAULT`;
  }
}

export function isConcurrentlyUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /concurrently/i.test(message);
}

/** Destructive DDL patterns that must never appear in server output. */
export const FORBIDDEN_SERVER_DDL =
  /\bDROP TABLE\b|\bDROP COLUMN\b|ALTER (TABLE .+ )?ALTER COLUMN .+ TYPE (?!bigint\b)|\bRENAME\b|\bDROP VIEW\b|\bDROP TYPE\b|\bTRUNCATE\b/i;
