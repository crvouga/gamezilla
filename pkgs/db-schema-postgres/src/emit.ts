import type {
  CreateTableColumn,
  ServerOperation,
} from '@pkgs/db-schema/core/operations';
import { PG_TYPE_SQL } from '@pkgs/db-schema/core/type-map';
import type { Sql } from '@pkgs/sql';
import { ident, join, raw, sql } from '@pkgs/sql';

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
  if (col.generatedExpr !== undefined) {
    const stored =
      col.generatedStored === false ? raw('VIRTUAL') : raw('STORED');
    return sql`${ident(col.name)} ${typeSql} GENERATED ALWAYS AS (${raw(col.generatedExpr)}) ${stored}`;
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
    case 'add_check': {
      return sql`ALTER TABLE ${ident(op.table)} ADD CONSTRAINT ${ident(op.name)} CHECK (${raw(op.expression)})`;
    }
    case 'add_foreign_key': {
      return sql`ALTER TABLE ${ident(op.table)} ADD CONSTRAINT ${ident(op.name)} FOREIGN KEY (${ident(op.column)}) REFERENCES ${ident(op.refTable)} (${ident(op.refColumn)})`;
    }
    case 'create_view': {
      return sql`CREATE VIEW ${ident(op.name)} AS ${raw(op.expression)}`;
    }
    case 'replace_view': {
      return sql`CREATE OR REPLACE VIEW ${ident(op.name)} AS ${raw(op.expression)}`;
    }
    case 'create_enum': {
      if (op.nativePostgres) {
        const vals = op.values
          .map((v) => `'${v.replace(/'/g, "''")}'`)
          .join(', ');
        return raw(
          `DO $$ BEGIN CREATE TYPE "${String(op.name).replace(/"/g, '""')}" AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
        );
      }
      // Portable TEXT+CHECK enums are applied as table checks, not types.
      return sql`SELECT 1`;
    }
    case 'add_enum_value': {
      return raw(
        `ALTER TYPE "${op.name.replace(/"/g, '""')}" ADD VALUE IF NOT EXISTS '${op.value.replace(/'/g, "''")}'`
      );
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
  /\bDROP TABLE\b|\bDROP COLUMN\b|ALTER (TABLE .+ )?ALTER COLUMN .+ TYPE|\bRENAME\b|\bDROP VIEW\b|\bDROP TYPE\b|\bTRUNCATE\b/i;
