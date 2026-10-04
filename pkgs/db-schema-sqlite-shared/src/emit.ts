import {
  asPhysicalIdent,
  asSchemaIdent,
  rebuildOldTableIdent,
} from '@pkgs/db-schema-shared/index-fingerprint';
import type {
  ClientOperation,
  CreateTableColumn,
} from '@pkgs/db-schema-shared/operations';
import { SQLITE_TYPE_SQL } from '@pkgs/db-schema-shared/type-map';
import type { ColumnType, ReadonlyDeclaredSchema } from '@pkgs/db-schema-shared/types';
import { MANAGED_IMPLICIT_COLUMN_NAMES, MANAGED_IMPLICIT_COLUMNS } from '@pkgs/db-schema-shared/types';
import type { Sql } from '@pkgs/sql-shared/sql';
import sql, { ident, join, raw } from '@pkgs/sql-shared/sql';

function sqliteTypeOf(col: {
  type: ColumnType;
  physicalSqlite?: string;
}): string {
  if (col.physicalSqlite !== undefined) return col.physicalSqlite;
  return SQLITE_TYPE_SQL[col.type];
}

function columnDdl(col: CreateTableColumn): Sql<void> {
  const typeSql = raw(sqliteTypeOf(col));
  if (col.isPrimaryKey) {
    return sql`${ident(col.name)} ${typeSql} PRIMARY KEY`;
  }
  return sql`${ident(col.name)} ${typeSql}`;
}

type RebuildArgs = {
  readonly table: string;
  readonly declared: ReadonlyDeclaredSchema;
  readonly extras: Readonly<Record<string, string>>;
  readonly copyColumns: readonly string[];
  readonly copyAliases?: Readonly<Record<string, string>>;
  readonly backfills?: Readonly<Record<string, string>>;
};

/**
 * Emit SQLite DDL for a client operation. Rebuilds preserve every undeclared
 * column verbatim, so a stale or newer bundle never loses local data.
 */
export function emitClientOperation(
  op: ClientOperation,
  declared: ReadonlyDeclaredSchema
): Sql<unknown>[] {
  switch (op.kind) {
    case 'create_table': {
      const cols = buildTableColumnDdls(op.columns);
      return [
        sql`CREATE TABLE IF NOT EXISTS ${ident(op.table)} (${join(cols, ', ')}) STRICT`,
      ];
    }
    case 'add_column': {
      const typeSql = raw(sqliteTypeOf(op));
      return [
        sql`ALTER TABLE ${ident(op.table)} ADD COLUMN ${ident(op.column)} ${typeSql}`,
      ];
    }
    case 'backfill': {
      return [
        sql`UPDATE ${ident(op.table)} SET ${ident(op.column)} = ${raw(op.expression)} WHERE ${ident(op.column)} IS NULL`,
      ];
    }
    case 'create_index': {
      const cols = op.columns.map((c) => ident(c));
      const uniqueKw = op.unique ? raw('UNIQUE ') : raw('');
      return [
        sql`CREATE ${uniqueKw}INDEX IF NOT EXISTS ${ident(op.name)} ON ${ident(op.table)} (${join(cols, ', ')})`,
      ];
    }
    case 'drop_index': {
      return [sql`DROP INDEX IF EXISTS ${ident(op.name)}`];
    }
    case 'drop_table': {
      return [sql`DROP TABLE IF EXISTS ${ident(op.table)}`];
    }
    case 'rebuild_table': {
      return emitRebuild({
        table: op.table,
        declared,
        extras: op.preserveExtras,
        copyColumns: op.copyColumns,
        ...(op.copyAliases !== undefined
          ? { copyAliases: op.copyAliases }
          : {}),
        ...(op.backfills !== undefined ? { backfills: op.backfills } : {}),
      });
    }
    case 'drop_not_null':
    case 'widen_integer':
    case 'drop_default':
      return refuseSqliteRepair(op.kind);
  }
}

function refuseSqliteRepair(kind: string): never {
  throw new Error(`sqlite reconcile does not apply ${kind}`);
}

function buildTableColumnDdls(
  columns: readonly CreateTableColumn[]
): Sql<void>[] {
  return columns.map((c) => columnDdl(c));
}

function physicalSqliteType(physical: string): string {
  const upper = physical.toUpperCase();
  if (upper === 'INTEGER' || upper === 'REAL' || upper === 'BLOB') {
    return upper;
  }
  return 'TEXT';
}

function declaredColumnDdls(
  table: string,
  declared: ReadonlyDeclaredSchema
): Sql<void>[] {
  const createCols: CreateTableColumn[] = [];
  for (const name of MANAGED_IMPLICIT_COLUMN_NAMES) {
    createCols.push({
      name: asSchemaIdent(name),
      type: MANAGED_IMPLICIT_COLUMNS[name],
      isPrimaryKey: name === 'id',
    });
  }
  for (const [name, col] of Object.entries(declared.tables[table]!)) {
    createCols.push({
      name: asSchemaIdent(name),
      type: col.type,
      isPrimaryKey: false,
      ...(col.physicalSqlite !== undefined
        ? { physicalSqlite: col.physicalSqlite }
        : {}),
    });
  }
  return buildTableColumnDdls(createCols);
}

function rebuildColumnDdl(args: RebuildArgs): Sql<void>[] {
  const cols = declaredColumnDdls(args.table, args.declared);
  for (const name of Object.keys(args.extras)) {
    cols.push(
      sql`${ident(asPhysicalIdent(name))} ${raw(physicalSqliteType(args.extras[name]!))}`
    );
  }
  return cols;
}

function copyStatements(args: RebuildArgs, oldTable: string): Sql<unknown>[] {
  if (args.copyColumns.length === 0) return [];
  const destCols = args.copyColumns.map((n) => ident(n));
  const srcCols = args.copyColumns.map((n) => {
    const alias = args.copyAliases?.[n];
    return ident(alias ?? n);
  });
  return [
    sql`INSERT INTO ${ident(args.table)} (${join(destCols, ', ')}) SELECT ${join(srcCols, ', ')} FROM ${ident(oldTable)}`,
  ];
}

function backfillStatements(
  args: RebuildArgs,
  copyColumns: readonly string[]
): Sql<unknown>[] {
  const stmts: Sql<unknown>[] = [];
  for (const [column, expression] of Object.entries(args.backfills ?? {})) {
    if (copyColumns.includes(column)) continue;
    stmts.push(
      sql`UPDATE ${ident(args.table)} SET ${ident(asSchemaIdent(column))} = ${raw(expression)} WHERE ${ident(asSchemaIdent(column))} IS NULL`
    );
  }
  return stmts;
}

function emitRebuild(args: RebuildArgs): Sql<unknown>[] {
  const oldTable = rebuildOldTableIdent(args.table);
  const cols = rebuildColumnDdl(args);
  return [
    sql`ALTER TABLE ${ident(args.table)} RENAME TO ${ident(oldTable)}`,
    sql`CREATE TABLE ${ident(args.table)} (${join(cols, ', ')}) STRICT`,
    ...copyStatements(args, oldTable),
    ...backfillStatements(args, args.copyColumns),
    sql`DROP TABLE ${ident(oldTable)}`,
  ];
}
