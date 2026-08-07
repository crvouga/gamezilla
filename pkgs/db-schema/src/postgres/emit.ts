import type { Sql } from '@pkgs/sql';
import { ident, join, raw, sql } from '@pkgs/sql';
import type { ServerOperation } from '../core/operations';
import { PG_TYPE_SQL } from '../core/type-map';

function columnDdl(
  name: string,
  type: keyof typeof PG_TYPE_SQL,
  isPrimaryKey: boolean
): Sql<void> {
  const typeSql = raw(PG_TYPE_SQL[type]);
  if (isPrimaryKey) {
    return sql`${ident(name)} ${typeSql} primary key DEFAULT gen_random_uuid()`;
  }
  if (name === '_created_at' || name === '_updated_at') {
    return sql`${ident(name)} ${typeSql} DEFAULT now()`;
  }
  return sql`${ident(name)} ${typeSql}`;
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
      const cols = op.columns.map((c) =>
        columnDdl(c.name, c.type, c.isPrimaryKey)
      );
      return sql`CREATE TABLE IF NOT EXISTS ${ident(op.table)} (${join(cols, ', ')})`;
    }
    case 'add_column': {
      const typeSql = raw(PG_TYPE_SQL[op.type]);
      return sql`ALTER TABLE ${ident(op.table)} ADD COLUMN IF NOT EXISTS ${ident(op.column)} ${typeSql}`;
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
  }
}

export function isConcurrentlyUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /concurrently/i.test(message);
}

export function emitServerOperations(
  ops: readonly ServerOperation[]
): Sql<unknown>[] {
  return ops.map((op) => emitServerOperation(op));
}

/** Destructive DDL patterns that must never appear in server output. */
export const FORBIDDEN_SERVER_DDL =
  /DROP TABLE|DROP COLUMN|ALTER (TABLE .+ )?ALTER COLUMN .+ TYPE|TRUNCATE/i;
